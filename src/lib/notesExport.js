import { jsPDF } from 'jspdf'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from 'docx'
import { saveAs } from 'file-saver'

// Brand colors (from LogoIcon gradient: indigo-600 to violet-700)
const BRAND_PRIMARY = [79, 70, 229]    // indigo-600
const BRAND_SECONDARY = [109, 40, 217] // violet-700
const BRAND_DARK = [30, 27, 75]        // indigo-950
const BRAND_LIGHT = [238, 242, 255]    // indigo-50

// Parse markdown notes into structured sections
function parseNotes(markdown) {
  const sections = []
  const lines = markdown.split('\n')
  let currentSection = null

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/)
    const h1 = line.match(/^#\s+(.+)$/)
    const h3 = line.match(/^###\s+(.+)$/)
    const heading = h1 || h2 || h3

    if (heading) {
      if (currentSection) sections.push(currentSection)
      currentSection = { title: heading[1].replace(/\*\*/g, ''), lines: [] }
    } else if (line.trim()) {
      if (!currentSection) currentSection = { title: '', lines: [] }
      currentSection.lines.push(line)
    }
  }
  if (currentSection) sections.push(currentSection)
  return sections
}

// Strip markdown formatting for plain text
function stripMd(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+\.\s+/, '')
}

// Parse inline bold segments: returns array of { text, bold }
function parseInline(text) {
  const parts = []
  const regex = /\*\*(.+?)\*\*/g
  let last = 0
  let match
  const cleaned = text.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '')

  while ((match = regex.exec(cleaned)) !== null) {
    if (match.index > last) {
      parts.push({ text: cleaned.slice(last, match.index), bold: false })
    }
    parts.push({ text: match[1], bold: true })
    last = match.index + match[0].length
  }
  if (last < cleaned.length) {
    parts.push({ text: cleaned.slice(last), bold: false })
  }
  return parts.length ? parts : [{ text: cleaned, bold: false }]
}

// ─── PDF Export ───

export function downloadPDF(notesMarkdown, meta) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 18
  const contentW = pageW - margin * 2
  let y = 0

  function checkPage(needed = 12) {
    if (y + needed > pageH - 20) {
      addFooter(doc, pageW, pageH)
      doc.addPage()
      y = 20
    }
  }

  // Header bar
  doc.setFillColor(...BRAND_PRIMARY)
  doc.rect(0, 0, pageW, 32, 'F')
  // Gradient overlay
  doc.setFillColor(...BRAND_SECONDARY)
  doc.rect(pageW * 0.5, 0, pageW * 0.5, 32, 'F')

  // Logo icon (chart arrow SVG approximation)
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.8)
  const lx = margin + 2
  const ly = 11
  doc.line(lx, ly + 10, lx + 5, ly + 5)
  doc.line(lx + 5, ly + 5, lx + 8, ly + 8)
  doc.line(lx + 8, ly + 8, lx + 14, ly + 2)
  doc.line(lx + 11, ly + 2, lx + 14, ly + 2)
  doc.line(lx + 14, ly + 2, lx + 14, ly + 5)

  // Title
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Beat the S&P 500', margin + 20, 15)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Class Discussion Notes', margin + 20, 22)

  // Date/meta line
  if (meta) {
    doc.setFontSize(8)
    doc.setTextColor(220, 220, 255)
    doc.text(meta, margin + 20, 28)
  }

  y = 40

  // Parse and render sections
  const sections = parseNotes(notesMarkdown)

  for (const section of sections) {
    checkPage(20)

    // Section heading with colored left border
    doc.setFillColor(...BRAND_PRIMARY)
    doc.rect(margin, y - 1, 2, 8, 'F')
    doc.setTextColor(...BRAND_DARK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(stripMd(section.title), margin + 6, y + 5)
    y += 12

    // Section content
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(50, 50, 50)

    for (const line of section.lines) {
      checkPage(8)
      const clean = stripMd(line)
      const isBullet = line.match(/^[-*]\s+/) || line.match(/^\d+\.\s+/)

      if (isBullet) {
        doc.setFillColor(...BRAND_SECONDARY)
        doc.circle(margin + 4, y + 1.5, 1, 'F')
      }

      const indent = isBullet ? margin + 8 : margin + 4
      const wrapped = doc.splitTextToSize(clean, contentW - (indent - margin) - 2)
      for (const wline of wrapped) {
        checkPage(6)
        doc.text(wline, indent, y + 3)
        y += 5
      }
      y += 1
    }

    y += 6
  }

  addFooter(doc, pageW, pageH)

  const dateStr = new Date().toISOString().split('T')[0]
  doc.save(`class-notes-${dateStr}.pdf`)
}

function addFooter(doc, pageW, pageH) {
  doc.setFillColor(...BRAND_LIGHT)
  doc.rect(0, pageH - 10, pageW, 10, 'F')
  doc.setFontSize(7)
  doc.setTextColor(120, 120, 140)
  doc.text('Beat the S&P 500 | Class Discussion Notes', 18, pageH - 4)
  doc.text(`Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, pageW - 18, pageH - 4, { align: 'right' })
}

// ─── DOCX Export ───

export async function downloadDOCX(notesMarkdown, meta) {
  const sections = parseNotes(notesMarkdown)

  const children = []

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Beat the S&P 500', bold: true, size: 36, color: '4F46E5', font: 'Helvetica' }),
      ],
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Class Discussion Notes', size: 22, color: '6D28D9', font: 'Helvetica' }),
      ],
      spacing: { after: 80 },
    })
  )

  // Meta line
  if (meta) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: meta, size: 18, color: '6B7280', italics: true }),
        ],
        spacing: { after: 200 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: '4F46E5' },
        },
      })
    )
  }

  // Sections
  for (const section of sections) {
    // Section heading
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: stripMd(section.title), bold: true, size: 26, color: '4F46E5', font: 'Helvetica' }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 120 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 12, color: '4F46E5', space: 8 },
        },
      })
    )

    // Content lines
    for (const line of section.lines) {
      const isBullet = line.match(/^[-*]\s+/) || line.match(/^\d+\.\s+/)
      const inlineParts = parseInline(line)

      const runs = inlineParts.map(p => new TextRun({
        text: p.text,
        bold: p.bold,
        size: 20,
        color: '1F2937',
        font: 'Calibri',
      }))

      children.push(
        new Paragraph({
          children: runs,
          bullet: isBullet ? { level: 0 } : undefined,
          spacing: { after: 80 },
        })
      )
    }
  }

  // Footer
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, size: 16, color: '9CA3AF', italics: true }),
      ],
      spacing: { before: 400 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 6, color: 'E5E7EB' },
      },
    })
  )

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20, color: '1F2937' },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1000, bottom: 800, left: 1200, right: 1200 },
        },
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const dateStr = new Date().toISOString().split('T')[0]
  saveAs(blob, `class-notes-${dateStr}.docx`)
}
