import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { jsPDF } from 'jspdf';
import { type MediaAuthenticityStatus } from '@/lib/types';
import { getFriendlyAuthenticityMessage } from '@/lib/mediaAuthenticity';

export async function POST(request: NextRequest) {
  try {
    const { uploadId } = await request.json();

    if (!uploadId) {
      return NextResponse.json({ error: 'Upload ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the upload record
    const { data: upload, error: uploadError } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .eq('user_id', user.id)
      .single();

    if (uploadError || !upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    // Get the analysis result
    const { data: analysis, error: analysisError } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('upload_id', uploadId)
      .single();

    if (analysisError || !analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    // Build the PDF
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    // Helper: sanitize text to ASCII-safe characters for jsPDF's default helvetica font
    const sanitizeText = (text: string): string => {
      if (!text) return '';
      return text
        // Replace common Unicode punctuation with ASCII equivalents
        .replace(/[\u2018\u2019\u201A]/g, "'")   // smart single quotes
        .replace(/[\u201C\u201D\u201E]/g, '"')   // smart double quotes
        .replace(/\u2026/g, '...')               // ellipsis
        .replace(/[\u2013\u2014]/g, '-')         // en/em dash
        .replace(/\u2022/g, '-')                 // bullet
        .replace(/\u2713|\u2714|\u2705/g, '-')   // checkmarks
        .replace(/\u26A0|\uFE0F/g, '')           // warning sign, variation selector
        .replace(/[\u00A0]/g, ' ')               // non-breaking space
        .replace(/[\u200B-\u200D\uFEFF]/g, '')   // zero-width chars
        // Strip any remaining non-printable or non-Latin1 characters
        .replace(/[^\x20-\x7E\xA1-\xFF\n\r\t]/g, '')
        .trim();
    };

    const addPageIfNeeded = (requiredSpace: number) => {
      if (y + requiredSpace > 270) {
        doc.addPage();
        y = 20;
      }
    };

    // Helper to add wrapped text and return new Y
    const addWrappedText = (text: string, x: number, startY: number, maxWidth: number, lineHeight: number): number => {
      const safeText = sanitizeText(text);
      const lines = doc.splitTextToSize(safeText, maxWidth);
      for (let i = 0; i < lines.length; i++) {
        addPageIfNeeded(lineHeight);
        doc.text(lines[i], x, startY + i * lineHeight);
      }
      return startY + lines.length * lineHeight;
    };

    // ═══ HEADER ═══
    doc.setFillColor(10, 37, 64); // --bg-dark navy
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('ShieldHer', margin, 18);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('AI-Powered Evidence Report', margin, 26);

    const dateStr = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    doc.setFontSize(9);
    doc.text(`Generated: ${dateStr}`, margin, 34);

    doc.setFontSize(9);
    doc.text(`Report ID: ${analysis.id.substring(0, 8).toUpperCase()}`, pageWidth - margin, 34, { align: 'right' });

    y = 50;

    // ═══ EVIDENCE CALLOUT ═══
    doc.setFillColor(99, 91, 255); // accent indigo
    doc.roundedRect(margin, y, contentWidth, 18, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('This report can be used as supporting evidence when consulting a', margin + 6, y + 7);
    doc.text('lawyer, counselor, or filing a complaint with the authorities.', margin + 6, y + 13);
    y += 26;

    // ═══ RISK LEVEL ═══
    doc.setTextColor(10, 37, 64);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Risk Assessment', margin, y);
    y += 8;

    const riskColors: Record<string, [number, number, number]> = {
      safe: [0, 212, 170],
      low: [59, 130, 246],
      medium: [245, 158, 11],
      high: [239, 68, 68],
      critical: [220, 38, 38],
    };
    const riskLabels: Record<string, string> = {
      safe: 'SAFE',
      low: 'LOW RISK',
      medium: 'MEDIUM RISK',
      high: 'HIGH RISK',
      critical: 'CRITICAL',
    };

    const riskColor = riskColors[analysis.risk_level] || [100, 100, 100];
    doc.setFillColor(...riskColor);
    doc.roundedRect(margin, y, 40, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(riskLabels[analysis.risk_level] || analysis.risk_level.toUpperCase(), margin + 20, y + 5.5, { align: 'center' });
    y += 16;

    // ═══ FILE INFO ═══
    doc.setTextColor(66, 84, 102);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`File: ${upload.file_name}`, margin, y);
    y += 5;
    doc.text(`Analyzed: ${new Date(analysis.created_at).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, margin, y);
    y += 10;

    // ═══ SUMMARY ═══
    doc.setTextColor(10, 37, 64);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Analysis Summary', margin, y);
    y += 7;

    doc.setTextColor(66, 84, 102);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    y = addWrappedText(analysis.summary || 'No summary available.', margin, y, contentWidth, 5);
    y += 8;

    // ═══ FLAGS ═══
    const flags = analysis.flags || [];
    if (flags.length > 0) {
      addPageIfNeeded(20);
      doc.setTextColor(10, 37, 64);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(`Detected Flags (${flags.length})`, margin, y);
      y += 8;

      for (const flag of flags) {
        addPageIfNeeded(25);
        // Flag severity badge
        const flagColor = riskColors[flag.severity] || [100, 100, 100];
        doc.setFillColor(...flagColor);
        doc.roundedRect(margin, y, 28, 6, 1.5, 1.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(sanitizeText((flag.severity || '').toUpperCase()), margin + 14, y + 4.2, { align: 'center' });

        // Category
        doc.setTextColor(10, 37, 64);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(sanitizeText(flag.category || ''), margin + 32, y + 4.5);
        y += 9;

        // Description
        doc.setTextColor(66, 84, 102);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        if (flag.description) {
          y = addWrappedText(flag.description, margin + 4, y, contentWidth - 4, 4.5);
          y += 2;
        }

        // Evidence
        if (flag.evidence) {
          doc.setFillColor(237, 241, 247);
          const evidenceLines = doc.splitTextToSize(sanitizeText(`"${flag.evidence}"`), contentWidth - 12);
          const evidenceHeight = evidenceLines.length * 4.5 + 4;
          addPageIfNeeded(evidenceHeight);
          doc.roundedRect(margin + 4, y, contentWidth - 8, evidenceHeight, 1.5, 1.5, 'F');
          doc.setTextColor(136, 152, 170);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          for (let i = 0; i < evidenceLines.length; i++) {
            doc.text(evidenceLines[i], margin + 8, y + 4 + i * 4.5);
          }
          y += evidenceHeight + 4;
        }

        y += 2;
      }
      y += 4;
    }

    // ═══ DETAILS ═══
    const details = analysis.details || {};

    // Media Authenticity
    const authenticity = details.media_authenticity;
    if (authenticity && authenticity.supported_count > 0) {
      addPageIfNeeded(24);
      doc.setTextColor(10, 37, 64);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Media Authenticity Check', margin, y);
      y += 8;

      const statusColorMap: Record<MediaAuthenticityStatus, [number, number, number]> = {
        ai_generated: [239, 68, 68],
        likely_human: [0, 166, 124],
        inconclusive: [245, 158, 11],
        unsupported: [100, 116, 139],
        unavailable: [100, 116, 139],
      };
      const badgeColor = statusColorMap[authenticity.status as MediaAuthenticityStatus] || [100, 116, 139];
      doc.setFillColor(...badgeColor);
      doc.roundedRect(margin, y, 48, 7, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(sanitizeText((authenticity.label || 'UNKNOWN').toUpperCase()), margin + 24, y + 4.8, { align: 'center' });

      if (typeof authenticity.ai_probability === 'number') {
        doc.setTextColor(66, 84, 102);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`AI likelihood: ${authenticity.ai_probability}%`, pageWidth - margin, y + 4.8, { align: 'right' });
      }
      y += 11;

      doc.setTextColor(66, 84, 102);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      y = addWrappedText(
        getFriendlyAuthenticityMessage(authenticity.status as MediaAuthenticityStatus),
        margin,
        y,
        contentWidth,
        5
      );
      y += 4;

      if (authenticity.items && authenticity.items.length > 0) {
        doc.setTextColor(66, 84, 102);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        for (const item of authenticity.items) {
          addPageIfNeeded(8);
          const line = `${item.file_name}: ${item.label}`;
          const lineParts = doc.splitTextToSize(sanitizeText(`- ${line}`), contentWidth - 4);
          for (let i = 0; i < lineParts.length; i++) {
            addPageIfNeeded(5);
            doc.text(lineParts[i], margin + 4, y + i * 4.5);
          }
          y += lineParts.length * 4.5 + 1;
        }
      }
      y += 6;
    }

    // Tone Analysis
    if (details.tone_analysis) {
      addPageIfNeeded(20);
      doc.setTextColor(10, 37, 64);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Tone Analysis', margin, y);
      y += 7;
      doc.setTextColor(66, 84, 102);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      y = addWrappedText(details.tone_analysis, margin, y, contentWidth, 5);
      y += 8;
    }

    // Manipulation Indicators
    if (details.manipulation_indicators && details.manipulation_indicators.length > 0) {
      addPageIfNeeded(20);
      doc.setTextColor(10, 37, 64);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Manipulation Indicators', margin, y);
      y += 7;
      doc.setTextColor(66, 84, 102);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      for (const indicator of details.manipulation_indicators) {
        addPageIfNeeded(6);
        doc.text(sanitizeText(`- ${indicator}`), margin + 4, y);
        y += 5;
      }
      y += 4;
    }

    // Recommendations
    if (details.recommendations && details.recommendations.length > 0) {
      addPageIfNeeded(20);
      doc.setTextColor(10, 37, 64);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Recommendations', margin, y);
      y += 7;
      doc.setTextColor(66, 84, 102);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      for (const rec of details.recommendations) {
        addPageIfNeeded(10);
        const recLines = doc.splitTextToSize(sanitizeText(`- ${rec}`), contentWidth - 4);
        for (let i = 0; i < recLines.length; i++) {
          addPageIfNeeded(5);
          doc.text(recLines[i], margin + 4, y + i * 4.5);
        }
        y += recLines.length * 4.5 + 2;
      }
      y += 4;
    }

    // Legal Analysis
    if (details.legal_analysis) {
      addPageIfNeeded(25);
      doc.setTextColor(10, 37, 64);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Preliminary Legal Analysis', margin, y);
      y += 7;

      doc.setTextColor(66, 84, 102);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      if (details.legal_analysis.summary) {
        y = addWrappedText(details.legal_analysis.summary, margin, y, contentWidth, 5);
        y += 5;
      }

      if (details.legal_analysis.potential_violations && details.legal_analysis.potential_violations.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Potential Violations:', margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        for (const violation of details.legal_analysis.potential_violations) {
          const violationLines = doc.splitTextToSize(sanitizeText(`- ${violation}`), contentWidth - 4);
          for (let i = 0; i < violationLines.length; i++) {
            addPageIfNeeded(5);
            doc.text(violationLines[i], margin + 4, y + i * 4.5);
          }
          y += violationLines.length * 4.5 + 0.5;
        }
        y += 4;
      }

      // Legal disclaimer box
      if (details.legal_analysis.disclaimer) {
        addPageIfNeeded(20);
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(239, 68, 68);
        const disclaimerLines = doc.splitTextToSize(sanitizeText(details.legal_analysis.disclaimer), contentWidth - 16);
        const disclaimerHeight = disclaimerLines.length * 4.5 + 8;
        doc.roundedRect(margin, y, contentWidth, disclaimerHeight, 2, 2, 'FD');
        doc.setTextColor(180, 40, 40);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('[!] LEGAL DISCLAIMER', margin + 6, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        for (let i = 0; i < disclaimerLines.length; i++) {
          doc.text(disclaimerLines[i], margin + 6, y + 10 + i * 4.5);
        }
        y += disclaimerHeight + 8;
      }
    }

    // ═══ FOOTER ═══
    addPageIfNeeded(20);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
    doc.setTextColor(136, 152, 170);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('This report was generated by ShieldHer — AI-Powered Women\'s Safety Platform', margin, y);
    y += 4;
    doc.text('© ' + new Date().getFullYear() + ' ShieldHer. This document is confidential.', margin, y);

    // Generate PDF as buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // Upload to Supabase Storage
    const reportFileName = `${user.id}/report-${analysis.id.substring(0, 8)}-${Date.now()}.pdf`;
    const { error: storageError } = await supabase.storage
      .from('reports')
      .upload(reportFileName, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
      });

    if (storageError) {
      console.error('Storage error:', storageError);
      // If storage fails, still return the PDF directly
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="ShieldHer-Report-${analysis.id.substring(0, 8)}.pdf"`,
        },
      });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('reports')
      .getPublicUrl(reportFileName);

    // Store report record in DB
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        user_id: user.id,
        upload_id: uploadId,
        analysis_id: analysis.id,
        file_name: `ShieldHer-Report-${analysis.id.substring(0, 8)}.pdf`,
        file_url: publicUrl,
        risk_level: analysis.risk_level,
      })
      .select()
      .single();

    if (reportError) {
      console.error('Report DB error:', reportError);
    }

    // Return the PDF directly for download
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ShieldHer-Report-${analysis.id.substring(0, 8)}.pdf"`,
        'X-Report-Id': report?.id || '',
        'X-Report-Url': publicUrl || '',
      },
    });

  } catch (error: unknown) {
    console.error('Generate Report Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
