import re
import time

def apply_glossary(text, glossary):
    # Sort keys descending by length so longer phrases replace before their substrings
    sorted_keys = sorted(glossary.keys(), key=len, reverse=True)
    for k_word in sorted_keys:
        e_word = glossary[k_word]
        text = text.replace(k_word, f" {e_word} ")
    return text

def fix_joint_characters(text):
    # Custom Kannada "Joint Character" Unicode Fix, strictly same-line spaces (no newline matching)
    text = re.sub(r'([\u0C80-\u0CFF])[ \t]+([\u0CBE-\u0CCC\u0CCD])', r'\1\2', text)
    # Fix broken conjuncts (Vattus) where the virama is separated from the trailing consonant
    text = re.sub(r'(\u0CCD)[ \t]+([\u0C80-\u0CFF])', r'\1\2', text)
    return text

def kannada_quality_report(text):
    total_chars = len(text.strip())
    if total_chars == 0:
        return {"kannada_ratio": 0, "orphan_viramas": 0, "looks_garbled": False}

    kannada_chars = len(re.findall(r'[\u0C80-\u0CFF]', text))
    kannada_ratio = kannada_chars / total_chars
    
    # Check for garbled text indicating legacy fonts (Nudi/Baraha) extracted badly
    # Typically lots of Latin-1 supplement characters like Ã, ¤, ª, °, ¿ with no real Kannada
    latin1_supp_chars = len(re.findall(r'[\u00C0-\u00FF]', text))
    looks_garbled = latin1_supp_chars > 20 and kannada_chars == 0
    
    return {
        "kannada_ratio": kannada_ratio,
        "orphan_viramas": 0, # Could implement if needed
        "looks_garbled": looks_garbled
    }

def split_for_translation(text, max_len=1000):
    """
    Splits on newlines/sentences, never inside [..._REDACTED], never mid-word.
    Preserves all newlines.
    """
    chunks = []
    current_chunk = ""
    
    # Split text by common boundaries (newlines or sentence ends including danda) 
    # while keeping the boundaries attached using positive lookbehind/lookahead or re.split with groups.
    # To not split mid-placeholder, we can tokenize first.
    # Actually, a simpler way is to split by newline, then by sentence if line > max_len.
    lines = re.split(r'(\n)', text)
    
    for line in lines:
        if not line:
            continue
            
        if line == '\n':
            if len(current_chunk) + 1 <= max_len:
                current_chunk += line
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = line
            continue
            
        # If line itself is too long, we need to split by words or sentences
        if len(current_chunk) + len(line) <= max_len:
            current_chunk += line
        else:
            if current_chunk:
                chunks.append(current_chunk)
                current_chunk = ""
            
            if len(line) <= max_len:
                current_chunk = line
            else:
                # Split line into words, keeping spaces
                words = re.split(r'([ \t]+)', line)
                for word in words:
                    # Avoid splitting placeholders: if current_chunk + word exceeds, check if it's a placeholder
                    # But if a single word is somehow > max_len, we just have to append it (rare)
                    if len(current_chunk) + len(word) <= max_len:
                        current_chunk += word
                    else:
                        # Don't break if we are inside a placeholder. A placeholder has '[' but no ']' yet.
                        if '[' in current_chunk and ']' not in current_chunk.split('[')[-1]:
                            current_chunk += word
                        else:
                            if current_chunk:
                                chunks.append(current_chunk)
                            current_chunk = word
                            
    if current_chunk:
        chunks.append(current_chunk)
        
    return chunks

def translate_with_retry(chunks, translator, retries=3, backoff=2):
    results = []
    failed_indices = []
    
    for i, chunk in enumerate(chunks):
        if not chunk.strip():
            results.append(chunk)
            continue
            
        success = False
        for attempt in range(retries):
            try:
                res = translator.translate(chunk)
                if res and not any(err in res for err in ["That's an error", "That’s all we know", "Error 500", "Error 429"]):
                    results.append(res)
                    success = True
                    break
            except Exception:
                pass
            
            if attempt < retries - 1:
                time.sleep(backoff ** attempt)
                
        if not success:
            results.append(f"[UNTRANSLATED_KANNADA]{chunk}")
            failed_indices.append(i)
            
    return results, failed_indices
