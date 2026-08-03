import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { spawn } from 'child_process';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';

export async function POST(request: NextRequest) {
  try {
    const { uploadId, formData, fileUrl, decryptedBase64 } = await request.json();

    if (!uploadId) {
      return NextResponse.json({ error: 'Upload ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the upload record
    const { data: upload, error: uploadError } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (uploadError || !upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    const botDir = join(process.cwd(), 'bot');
    const tmpPayloadDir = join(botDir, 'rpa_tmp');
    await mkdir(tmpPayloadDir, { recursive: true });

    let effectiveFileUrl = fileUrl || upload.file_url;

    // If frontend sent decrypted image bytes, save directly to local evidence file on disk
    if (decryptedBase64) {
      const localEvidencePath = join(tmpPayloadDir, `evidence_${uploadId}.png`);
      await writeFile(localEvidencePath, Buffer.from(decryptedBase64, 'base64'));
      effectiveFileUrl = localEvidencePath;
      console.log(`[RPA Dispatcher] Saved decrypted evidence locally to: ${localEvidencePath}`);
    }

    // Construct full payload for bot
    const botPayload = {
      complaint_id: uploadId,
      id: uploadId,
      file_url: effectiveFileUrl,
      dispatch_metadata: {
        ...formData,
        file_url: effectiveFileUrl,
      },
      ...upload.dispatch_metadata,
    };

    const payloadPath = join(tmpPayloadDir, `payload_${uploadId}.json`);
    await writeFile(payloadPath, JSON.stringify(botPayload, null, 2), 'utf-8');

    // Spawn Python RPA bot in a detached process so Chrome GUI opens live on host desktop
    const pythonExe = process.platform === 'win32' ? 'python' : 'python3';
    const scriptPath = join(botDir, 'rpa_complaint_bot.py');

    console.log(`[RPA Dispatcher] Spawning live Chrome bot: ${pythonExe} ${scriptPath} --payload ${payloadPath}`);

    const botProcess = spawn(pythonExe, [scriptPath, '--payload', payloadPath], {
      cwd: botDir,
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        HEADLESS: 'false',
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });

    botProcess.unref();

    // Update DB upload status to 'ready_to_file'
    await supabase
      .from('uploads')
      .update({
        status: 'ready_to_file',
        dispatch_metadata: botPayload.dispatch_metadata,
      })
      .eq('id', uploadId);

    return NextResponse.json({
      success: true,
      message: 'RPA Legal Dispatcher spawned successfully! Chrome window is opening on your desktop.',
    });
  } catch (error: unknown) {
    console.error('Dispatch API Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage || 'Failed to dispatch RPA bot' }, { status: 500 });
  }
}
