import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { jsPDF } from 'jspdf';
import { type MediaAuthenticityStatus } from '@/lib/types';
import { getFriendlyAuthenticityMessage } from '@/lib/mediaAuthenticity';

export async function POST(request: NextRequest) {
  try {
    const { uploadId, decryptedAnalysis } = await request.json();

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
      .single();

    if (uploadError || !upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    // Check ownership or lawyer role
    if (upload.user_id !== user.id && user.user_metadata?.role !== 'lawyer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get the database analysis result
    const { data: dbAnalysis } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('upload_id', uploadId)
      .single();

    // Prefer client-supplied decryptedAnalysis, fallback to dbAnalysis
    const analysis = decryptedAnalysis 
      ? { ...dbAnalysis, ...decryptedAnalysis, id: dbAnalysis?.id || decryptedAnalysis?.id || uploadId }
      : dbAnalysis;

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    // ═════════════════════════════════════════════════════════════════
    // PDF DOCUMENT CREATION — Executive Design System
    // ═════════════════════════════════════════════════════════════════
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    let y = 18;

    // Sanitize text for default Helvetica font
    const sanitizeText = (text: string): string => {
      if (!text) return '';
      return text
        .replace(/^#+\s*/gm, '')                 // Clean markdown headers
        .replace(/\*\*+/g, '')                    // Clean markdown bold
        .replace(/[\u2018\u2019\u201A]/g, "'")   // Smart single quotes
        .replace(/[\u201C\u201D\u201E]/g, '"')   // Smart double quotes
        .replace(/\u2026/g, '...')               // Ellipsis
        .replace(/[\u2013\u2014]/g, '-')         // En/em dash
        .replace(/\u2022/g, '-')                 // Bullet
        .replace(/\u2713|\u2714|\u2705/g, '-')   // Checkmarks
        .replace(/\u26A0|\uFE0F/g, '')           // Warning sign
        .replace(/[\u00A0]/g, ' ')               // Non-breaking space
        .replace(/[\u200B-\u200D\uFEFF]/g, '')   // Zero-width chars
        .replace(/[^\x20-\x7E\xA1-\xFF\n\r\t]/g, '')
        .trim();
    };

    const addPageIfNeeded = (requiredSpace: number) => {
      if (y + requiredSpace > pageHeight - 22) {
        doc.addPage();
        y = 20;
      }
    };

    const addWrappedText = (
      text: string, 
      x: number, 
      startY: number, 
      maxWidth: number, 
      lineHeight: number = 4.5
    ): number => {
      const safeText = sanitizeText(text);
      const lines = doc.splitTextToSize(safeText, maxWidth);
      for (let i = 0; i < lines.length; i++) {
        addPageIfNeeded(lineHeight);
        doc.text(lines[i], x, startY + i * lineHeight);
      }
      return startY + lines.length * lineHeight;
    };

    // Render section title with accent line
    const renderSectionHeader = (title: string) => {
      addPageIfNeeded(16);
      doc.setTextColor(24, 24, 27); // Dark zinc
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, y);
      y += 3;
      doc.setDrawColor(226, 232, 240); // Soft grey line
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    };

    // ═══ HEADER BANNER ═══
    // Dark Executive Header
    doc.setFillColor(15, 23, 42); // Deep Slate Navy
    doc.rect(0, 0, pageWidth, 38, 'F');

    // Brand Emerald Accent Bar
    doc.setFillColor(16, 185, 129); // Emerald
    doc.rect(0, 37, pageWidth, 1.5, 'F');

    // Logo & Brand Name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('ShieldHer', margin, 18);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(52, 211, 153); // Mint green accent
    doc.text('AI FORENSIC & LEGAL EVIDENCE REPORT', margin, 25);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // Muted slate text
    doc.text('Confidential Document • Certified Cryptographic Chain of Custody', margin, 31);

    // Header Right Meta
    const reportIdStr = `REPORT ID: #${analysis.id.substring(0, 8).toUpperCase()}`;
    const dateStr = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(reportIdStr, pageWidth - margin, 18, { align: 'right' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${dateStr}`, pageWidth - margin, 25, { align: 'right' });

    y = 46;

    // ═══ CERTIFIED EVIDENCE CALLOUT BOX ═══
    doc.setFillColor(247, 244, 237); // Warm ivory container
    doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'F');

    // Gold/Emerald Accent bar on left of callout
    doc.setFillColor(217, 119, 6); // Gold accent
    doc.roundedRect(margin, y, 2.5, 16, 1, 1, 'F');

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('OFFICIAL E-EVIDENCE NOTICE:', margin + 6, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'This document contains AI-analyzed digital evidence formatted for legal counsel, cybercrime reporting, and court filings.',
      margin + 6,
      y + 11
    );
    y += 22;

    // ═══ METADATA & RISK SUMMARY GRID BOX ═══
    doc.setFillColor(248, 250, 252); // Soft blue-grey box
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');

    // Risk Level Colors & Labels
    const riskColors: Record<string, [number, number, number]> = {
      safe: [5, 150, 105],       // Emerald
      low: [2, 132, 199],        // Sky blue
      medium: [217, 119, 6],     // Gold / Amber
      high: [220, 38, 38],       // Red
      critical: [185, 28, 28],    // Dark Red
    };

    const riskLabels: Record<string, string> = {
      safe: 'SAFE',
      low: 'LOW RISK',
      medium: 'MEDIUM RISK',
      high: 'HIGH RISK',
      critical: 'CRITICAL THREAT',
    };

    const currentRisk = (analysis.risk_level || 'safe').toLowerCase();
    const riskColor = riskColors[currentRisk] || [100, 116, 139];
    const riskLabel = riskLabels[currentRisk] || currentRisk.toUpperCase();

    // Left Column Info
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('EVIDENCE FILE:', margin + 6, y + 7);
    doc.text('SUBMITTED DATE:', margin + 6, y + 13);
    doc.text('ANALYSIS ENGINE:', margin + 6, y + 19);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(sanitizeText(upload.file_name || 'Uploaded Asset'), margin + 34, y + 7);
    doc.text(
      new Date(analysis.created_at).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      margin + 34,
      y + 13
    );
    doc.text('ShieldHer Forensics v2.4 (E2EE Proxy)', margin + 34, y + 19);

    // Right Column Risk Badge
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('RISK ASSESSMENT:', pageWidth - margin - 46, y + 7);

    // Draw Risk Pill Badge
    doc.setFillColor(...riskColor);
    doc.roundedRect(pageWidth - margin - 46, y + 10, 40, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(riskLabel, pageWidth - margin - 26, y + 15.5, { align: 'center' });

    y += 30;

    // ═══ ANALYSIS SUMMARY ═══
    renderSectionHeader('Executive Analysis Summary');
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    y = addWrappedText(analysis.summary || 'No summary available for this analysis.', margin, y, contentWidth, 4.8);
    y += 8;

    // ═══ MEDIA AUTHENTICITY CHECK ═══
    const details = analysis.details || {};
    const authenticity = details.media_authenticity;

    if (authenticity && (authenticity.supported_count > 0 || authenticity.label || authenticity.status)) {
      renderSectionHeader('Media Authenticity & Deepfake Verification');

      // Status Badge Color
      const statusColorMap: Record<MediaAuthenticityStatus, [number, number, number]> = {
        authentic: [5, 150, 105],
        likely_human: [5, 150, 105],
        ai_generated: [220, 38, 38],
        manipulated: [220, 38, 38],
        ai_assisted: [217, 119, 6],
        inconclusive: [217, 119, 6],
        unsupported: [100, 116, 139],
        unavailable: [100, 116, 139],
      };

      const badgeColor = statusColorMap[authenticity.status as MediaAuthenticityStatus] || [100, 116, 139];
      const authLabel = (authenticity.label || authenticity.status || 'UNKNOWN').toUpperCase();

      doc.setFillColor(...badgeColor);
      doc.roundedRect(margin, y, 46, 7, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(sanitizeText(authLabel), margin + 23, y + 4.8, { align: 'center' });

      // AI Likelihood text
      const aiLikelihood = authenticity.ai_generation_probability ?? authenticity.ai_probability;
      if (typeof aiLikelihood === 'number') {
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`AI Likelihood: ${aiLikelihood}%`, pageWidth - margin, y + 5, { align: 'right' });
      }
      y += 11;

      // Explanation message
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      y = addWrappedText(
        getFriendlyAuthenticityMessage(authenticity.status as MediaAuthenticityStatus),
        margin,
        y,
        contentWidth,
        4.5
      );
      y += 4;

      // Authenticity & Manipulation score progress bars
      const authScore = typeof authenticity.authenticity_score === 'number' ? authenticity.authenticity_score : 85;
      const manipScore = typeof authenticity.manipulation_probability === 'number' ? authenticity.manipulation_probability : 10;
      const confScore = typeof authenticity.confidence_score === 'number' ? authenticity.confidence_score : 90;

      addPageIfNeeded(16);
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'F');

      // Metric 1: Authenticity
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`Authenticity Score: ${authScore}%`, margin + 6, y + 5.5);
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(margin + 6, y + 7.5, 45, 3, 1, 1, 'F');
      doc.setFillColor(5, 150, 105);
      doc.roundedRect(margin + 6, y + 7.5, (45 * Math.min(100, authScore)) / 100, 3, 1, 1, 'F');

      // Metric 2: Manipulation
      doc.setTextColor(71, 85, 105);
      doc.text(`Manipulation Prob: ${manipScore}%`, margin + 60, y + 5.5);
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(margin + 60, y + 7.5, 45, 3, 1, 1, 'F');
      doc.setFillColor(220, 38, 38);
      doc.roundedRect(margin + 60, y + 7.5, (45 * Math.min(100, manipScore)) / 100, 3, 1, 1, 'F');

      // Metric 3: AI Confidence
      doc.setTextColor(71, 85, 105);
      doc.text(`AI Confidence: ${confScore}%`, margin + 115, y + 5.5);
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(margin + 115, y + 7.5, 45, 3, 1, 1, 'F');
      doc.setFillColor(2, 132, 199);
      doc.roundedRect(margin + 115, y + 7.5, (45 * Math.min(100, confScore)) / 100, 3, 1, 1, 'F');

      y += 19;
    }

    // ═══ DETECTED THREAT & RISK FLAGS ═══
    const flags = analysis.flags || [];
    if (flags.length > 0) {
      renderSectionHeader(`Detected Pattern & Risk Flags (${flags.length})`);

      for (const flag of flags) {
        addPageIfNeeded(26);

        // Flag card background
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);

        const flagSeverity = (flag.severity || 'low').toLowerCase();
        const flagColor = riskColors[flagSeverity] || [100, 116, 139];

        // Flag severity pill
        doc.setFillColor(...flagColor);
        doc.roundedRect(margin, y, 26, 5.5, 1.5, 1.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text(sanitizeText(flagSeverity.toUpperCase()), margin + 13, y + 3.8, { align: 'center' });

        // Category name
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.text(sanitizeText(flag.category || 'Threat Indicator'), margin + 30, y + 4);
        y += 8;

        // Flag Description
        if (flag.description) {
          doc.setTextColor(51, 65, 85);
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'normal');
          y = addWrappedText(flag.description, margin + 4, y, contentWidth - 4, 4.2);
          y += 2;
        }

        // Evidence quote box
        if (flag.evidence) {
          addPageIfNeeded(14);
          doc.setFillColor(241, 245, 249);
          const evidenceLines = doc.splitTextToSize(sanitizeText(`"${flag.evidence}"`), contentWidth - 12);
          const boxHeight = evidenceLines.length * 4 + 5;
          
          doc.roundedRect(margin + 4, y, contentWidth - 8, boxHeight, 1.5, 1.5, 'F');
          doc.setFillColor(16, 185, 129); // Accent vertical bar
          doc.rect(margin + 4, y, 2, boxHeight, 'F');

          doc.setTextColor(71, 85, 105);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          for (let i = 0; i < evidenceLines.length; i++) {
            doc.text(evidenceLines[i], margin + 9, y + 4 + i * 4);
          }
          y += boxHeight + 4;
        } else {
          y += 3;
        }
      }
      y += 4;
    }

    // ═══ TONE & PSYCHOLOGICAL ANALYSIS ═══
    if (details.tone_analysis || (details.manipulation_indicators && details.manipulation_indicators.length > 0)) {
      renderSectionHeader('Tone & Psychological Dynamics');

      if (details.tone_analysis) {
        doc.setTextColor(51, 65, 85);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        y = addWrappedText(details.tone_analysis, margin, y, contentWidth, 4.5);
        y += 6;
      }

      if (details.manipulation_indicators && details.manipulation_indicators.length > 0) {
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Key Behavioral & Coercion Indicators:', margin, y);
        y += 5;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        for (const indicator of details.manipulation_indicators) {
          addPageIfNeeded(6);
          doc.text(`* ${sanitizeText(indicator)}`, margin + 4, y);
          y += 4.8;
        }
        y += 4;
      }
    }

    // ═══ RECOMMENDATIONS ═══
    if (details.recommendations && details.recommendations.length > 0) {
      renderSectionHeader('Expert Safety Recommendations');
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      for (const rec of details.recommendations) {
        addPageIfNeeded(8);
        const recLines = doc.splitTextToSize(sanitizeText(`- ${rec}`), contentWidth - 6);
        for (let i = 0; i < recLines.length; i++) {
          addPageIfNeeded(4.5);
          doc.text(recLines[i], margin + 4, y + i * 4.5);
        }
        y += recLines.length * 4.5 + 2;
      }
      y += 4;
    }

    // ═══ PRELIMINARY LEGAL MEMORANDUM ═══
    if (details.legal_analysis) {
      renderSectionHeader('Preliminary Legal Memorandum');

      if (details.legal_analysis.summary) {
        doc.setTextColor(51, 65, 85);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        y = addWrappedText(details.legal_analysis.summary, margin, y, contentWidth, 4.5);
        y += 6;
      }

      if (details.legal_analysis.potential_violations && details.legal_analysis.potential_violations.length > 0) {
        addPageIfNeeded(12);
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Potential Statutory Violations & Legal Grounds:', margin, y);
        y += 5.5;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.setFontSize(8.5);

        for (const violation of details.legal_analysis.potential_violations) {
          const violationLines = doc.splitTextToSize(sanitizeText(`- ${violation}`), contentWidth - 6);
          for (let i = 0; i < violationLines.length; i++) {
            addPageIfNeeded(4.5);
            doc.text(violationLines[i], margin + 4, y + i * 4.5);
          }
          y += violationLines.length * 4.5 + 1.5;
        }
        y += 4;
      }

      // Legal Disclaimer Container Box
      if (details.legal_analysis.disclaimer) {
        addPageIfNeeded(22);
        doc.setFillColor(254, 242, 242); // Soft red container
        doc.setDrawColor(252, 165, 165);
        doc.setLineWidth(0.4);

        const disclaimerLines = doc.splitTextToSize(sanitizeText(details.legal_analysis.disclaimer), contentWidth - 14);
        const boxHeight = disclaimerLines.length * 4 + 10;

        doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'FD');

        doc.setTextColor(185, 28, 28);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('LEGAL NOTICE & DISCLAIMER', margin + 6, y + 5.5);

        doc.setTextColor(127, 29, 29);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        for (let i = 0; i < disclaimerLines.length; i++) {
          doc.text(disclaimerLines[i], margin + 6, y + 10.5 + i * 4);
        }
        y += boxHeight + 8;
      }
    }

    // ═══ FOOTER ON ALL PAGES ═══
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);

      // Footer top rule
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

      // Footer text
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        'ShieldHer Safety Platform • Certified AI Evidence & Forensic Intelligence',
        margin,
        pageHeight - 9
      );
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth - margin,
        pageHeight - 9,
        { align: 'right' }
      );
    }

    // Generate PDF as buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // Upload to Supabase Storage in background for persistence
    const reportFileName = `${user.id}/report-${analysis.id.substring(0, 8)}-${Date.now()}.pdf`;
    const { error: storageError } = await supabase.storage
      .from('reports')
      .upload(reportFileName, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
      });

    if (storageError) {
      console.error('Storage error:', storageError);
    } else {
      const { data: { publicUrl } } = supabase.storage
        .from('reports')
        .getPublicUrl(reportFileName);

      try {
        await supabase
          .from('reports')
          .insert({
            user_id: user.id,
            upload_id: uploadId,
            analysis_id: analysis.id,
            file_name: `ShieldHer-Report-${analysis.id.substring(0, 8)}.pdf`,
            file_url: publicUrl,
            risk_level: analysis.risk_level,
          });
      } catch (err: unknown) {
        console.error('DB Report insert error:', err);
      }
    }

    // Return the PDF directly for preview & download
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="ShieldHer-Forensic-Report-${analysis.id.substring(0, 8)}.pdf"`,
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
