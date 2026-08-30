import re
import json

def chunk_legal_text(text: str, metadata_defaults: dict) -> list:
    """
    Parses a raw legal text document (such as a Central or State Act)
    and segments it into structural chunk entities representing Sections.
    """
    chunks = []
    
    # 1. Segment text by Chapters
    chapter_matches = list(re.finditer(r'(?i)\b(CHAPTER\s+[IVXLCDM\d]+[:.-]?\s*[^\n]*)', text))
    
    chapters = []
    if not chapter_matches:
        # Fallback if no chapters exist: treat entire text as one chapter block
        chapters.append(("General", text))
    else:
        for idx, match in enumerate(chapter_matches):
            start = match.start()
            end = chapter_matches[idx + 1].start() if idx + 1 < len(chapter_matches) else len(text)
            chap_header = match.group(1).strip()
            chap_content = text[start:end].strip()
            chapters.append((chap_header, chap_content))

    # 2. Segment each chapter by Section
    # Matches patterns like: "Section 3. Definition", "3. Definition of term", "12A. Power of Commissioner"
    section_pattern = r'(?m)^\s*(?:Section\s+)?(\d+[A-Z]?)\.?\s+([^\n]+)'
    
    for chap_header, chap_content in chapters:
        sec_matches = list(re.finditer(section_pattern, chap_content))
        
        if not sec_matches:
            # Fallback: if no sections matched, treat the whole chapter as a single chunk
            chunks.append({
                "chunk_id": f"{metadata_defaults.get('act', 'Act')}_{chap_header}",
                "content": f"{chap_header}\n{chap_content}",
                "metadata": {
                    **metadata_defaults,
                    "chapter": chap_header,
                    "section_number": "General",
                    "section_title": "General Provisions"
                }
            })
            continue

        for i, match in enumerate(sec_matches):
            start = match.start()
            end = sec_matches[i + 1].start() if i + 1 < len(sec_matches) else len(chap_content)
            
            sec_num = match.group(1).strip()
            sec_title = match.group(2).strip()
            sec_content = chap_content[start:end].strip()
            
            # Construct hierarchical context string (for semantic search retrieval context)
            context_header = f"{metadata_defaults.get('act', 'Act')} > {chap_header} > Section {sec_num}: {sec_title}"
            full_chunk_text = f"{context_header}\n\n{sec_content}"
            
            chunks.append({
                "chunk_id": f"{metadata_defaults.get('act', 'Act')}_Sec_{sec_num}",
                "content": full_chunk_text,
                "metadata": {
                    **metadata_defaults,
                    "chapter": chap_header,
                    "section_number": sec_num,
                    "section_title": sec_title
                }
            })
            
    return chunks
