import { supabase } from '../config/supabase.js';
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const BUCKET = 'attachments';

/**
 * Upload a file to Supabase Storage and record it in task_attachments.
 */
export async function uploadAttachment(projectId, taskId, file, userId) {
  if (!supabase) throw new Error('Supabase Storage not configured');

  const ext = file.originalname.split('.').pop();
  const storagePath = `${projectId}/${taskId}/${uuidv4()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  const { rows } = await query(
    `INSERT INTO task_attachments (task_id, file_name, file_url, file_size, mime_type, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [taskId, file.originalname, urlData.publicUrl, file.size, file.mimetype, userId]
  );

  return rows[0];
}

/**
 * Delete an attachment from Supabase Storage and the database.
 */
export async function deleteAttachment(attachmentId, taskId) {
  const { rows } = await query(
    'DELETE FROM task_attachments WHERE id = $1 AND task_id = $2 RETURNING *',
    [attachmentId, taskId]
  );

  if (!rows[0]) return null;

  if (supabase) {
    // Extract storage path from the public URL
    const url = new URL(rows[0].file_url);
    const pathPrefix = `/storage/v1/object/public/${BUCKET}/`;
    const storagePath = url.pathname.startsWith(pathPrefix)
      ? url.pathname.slice(pathPrefix.length)
      : null;

    if (storagePath) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
    }
  }

  return rows[0];
}

/**
 * List attachments for a task.
 */
export async function getAttachments(taskId) {
  const { rows } = await query(
    'SELECT * FROM task_attachments WHERE task_id = $1 ORDER BY created_at DESC',
    [taskId]
  );
  return rows;
}
