import { getDocument, GlobalWorkerOptions, PDFDateString } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
GlobalWorkerOptions.workerSrc = workerUrl;

const text = value => typeof value === 'string' ? value.trim() : '';
export async function extractMetadata(bytes) {
  const task = getDocument({ data: new Uint8Array(bytes) });
  try {
    const pdf = await task.promise;
    const { info, metadata: xmp } = await pdf.getMetadata();
    const value = key => xmp?.get(key);
    const creators = value('dc:creator');
    const rawDate = text(value('xmp:createdate')) || text(info.CreationDate);
    const parsedDate = rawDate.startsWith('D:') ? PDFDateString.toDateObject(rawDate) : null;
    return {
      metadata: {
        title: text(value('dc:title')) || text(info.Title),
        authors: Array.isArray(creators) ? creators.map(text).filter(Boolean).join('\n') : text(creators) || text(info.Author),
        description: text(value('dc:description')) || text(info.Subject),
        datePublished: '',
      },
      creationDate: parsedDate ? parsedDate.toISOString() : rawDate,
      failed: false, warning: '',
    };
  } catch (error) {
    return { metadata: { title: '', authors: '', description: '', datePublished: '' }, creationDate: '', failed: true, warning: `Metadata extraction failed: ${error?.message || 'PDF is protected or unreadable'}. Enter metadata manually and confirm inclusion, or exclude this PDF.` };
  } finally { try { await task.destroy(); } catch {} }
}
