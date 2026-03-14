// ─── Darkmatter — File Upload Scan API ───────────────────────
// POST /api/scan/upload
// Accepts multipart form data with files
// Returns security analysis findings

import { NextRequest, NextResponse } from 'next/server';
import { scanUploadedFiles } from '@/lib/security/zip-scanner';

<<<<<<< HEAD
=======
import JSZip from 'jszip';

>>>>>>> main
export const maxDuration = 120; // Large uploads may take longer

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const uploadedFiles: { name: string; content: string }[] = [];

        // Process all uploaded files
        for (const [, value] of formData.entries()) {
            if (value instanceof File) {
                const file = value;

                // Check file size (max 50MB)
                if (file.size > 50 * 1024 * 1024) {
                    return NextResponse.json(
                        { error: `File ${file.name} exceeds 50MB limit` },
                        { status: 400 }
                    );
                }

<<<<<<< HEAD
                // For ZIP files, we would need JSZip — for now handle individual files
                if (file.name.endsWith('.zip')) {
                    // Read the ZIP as an ArrayBuffer and try to handle as individual files
                    // For the MVP, we'll ask the user to upload individual files
                    // or we can integrate JSZip later
                    try {
                        const JSZip = (await import('jszip')).default;
=======
                // For ZIP files, handle extraction
                if (file.name.endsWith('.zip')) {
                    try {
>>>>>>> main
                        const arrayBuffer = await file.arrayBuffer();
                        const zip = await JSZip.loadAsync(arrayBuffer);

                        const filePromises: Promise<void>[] = [];
                        zip.forEach((relativePath, zipEntry) => {
                            if (!zipEntry.dir) {
                                filePromises.push(
                                    zipEntry.async('string').then((content) => {
                                        uploadedFiles.push({ name: relativePath, content });
                                    }).catch(() => {
                                        // Skip binary files that can't be read as string
                                    })
                                );
                            }
                        });

                        await Promise.all(filePromises);
                    } catch {
                        return NextResponse.json(
                            { error: 'Failed to extract ZIP file. Make sure it is a valid ZIP archive.' },
                            { status: 400 }
                        );
                    }
                } else {
                    // Individual file upload
                    try {
                        const content = await file.text();
                        uploadedFiles.push({ name: file.name, content });
                    } catch {
                        // Skip files that can't be read as text
                    }
                }
            }
        }

        if (uploadedFiles.length === 0) {
            return NextResponse.json(
                { error: 'No files uploaded or no readable files found.' },
                { status: 400 }
            );
        }

        // Create SSE stream
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const findings = await scanUploadedFiles(uploadedFiles, true, (msg) => {
                        const data = JSON.stringify({ type: 'progress', message: msg });
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    });

                    const result = JSON.stringify({
                        type: 'result',
                        findings,
                        filesUploaded: uploadedFiles.length,
                        totalFindings: findings.length,
                        critical: findings.filter(f => f.severity === 'critical').length,
                        high: findings.filter(f => f.severity === 'high').length,
                        medium: findings.filter(f => f.severity === 'medium').length,
                        low: findings.filter(f => f.severity === 'low').length,
                        info: findings.filter(f => f.severity === 'info').length,
                    });
                    controller.enqueue(encoder.encode(`data: ${result}\n\n`));
                } catch (err) {
                    const errorMsg = JSON.stringify({
                        type: 'error',
                        message: err instanceof Error ? err.message : 'Upload scan failed',
                    });
                    controller.enqueue(encoder.encode(`data: ${errorMsg}\n\n`));
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
