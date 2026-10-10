import os

with open("main.py", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Imports
if "import os" not in content:
    content = content.replace("import base64", "import os\nimport base64")

if "from kannada_normalizer" not in content:
    content = content.replace(
        "from chat_service import answer_document_query",
        "from chat_service import answer_document_query\nfrom kannada_normalizer import apply_glossary, kannada_quality_report, split_for_translation, translate_with_retry, fix_joint_characters"
    )

# 2. DocumentResponse
content = content.replace(
    "    summary_output: dict = {}",
    "    summary_output: dict = {}\n    translation_quality: dict = {}"
)

# 3. process_pdf garble check
old_pdf_ocr = """        needs_ocr = total_chars < 50 or (ocr_candidates and len(ocr_candidates) >= 1 and has_substantial_images(doc, ocr_candidates))
        if needs_ocr and ocr_candidates:"""
new_pdf_ocr = """        needs_ocr = total_chars < 50 or (ocr_candidates and len(ocr_candidates) >= 1 and has_substantial_images(doc, ocr_candidates))
        
        use_v2 = os.environ.get("KN_NORMALIZER_V2", "1") == "1"
        if use_v2:
            if kannada_quality_report(text).get("looks_garbled"):
                needs_ocr = True
                ocr_candidates = list(range(min(len(doc), MAX_OCR_PAGES)))
                
        if needs_ocr and ocr_candidates:"""
content = content.replace(old_pdf_ocr, new_pdf_ocr)

# 4. STAGE 0 Pre-processing
old_stage_0 = """    # Custom Kannada "Joint Character" Unicode Fix
    text = re.sub(r'([\u0C80-\u0CFF])\s+([\u0CBE-\u0CCC\u0CCD])', r'\1\2', text)

    # Modernize Kannada archaic script
    text = text.replace('\\u0CB1', '\\u0CB0').replace('\\u0CDE', '\\u0CB3')
    
    # Fix broken conjuncts (Vattus) where the virama is separated from the trailing consonant
    text = re.sub(r'(\u0CCD)\s+([\u0C80-\u0CFF])', r'\1\2', text)

    # Standard Unicode Normalization (NFKC)
    text = unicodedata.normalize('NFKC', text)"""

new_stage_0 = """    use_v2 = os.environ.get("KN_NORMALIZER_V2", "1") == "1"
    
    if use_v2:
        text = fix_joint_characters(text)
        text = text.replace('\\u0CB1', '\\u0CB0').replace('\\u0CDE', '\\u0CB3')
        text = unicodedata.normalize('NFKC', text)
    else:
        # Custom Kannada "Joint Character" Unicode Fix
        text = re.sub(r'([\u0C80-\u0CFF])\s+([\u0CBE-\u0CCC\u0CCD])', r'\\1\\2', text)
    
        # Modernize Kannada archaic script
        text = text.replace('\\u0CB1', '\\u0CB0').replace('\\u0CDE', '\\u0CB3')
        
        # Fix broken conjuncts (Vattus) where the virama is separated from the trailing consonant
        text = re.sub(r'(\u0CCD)\s+([\u0C80-\u0CFF])', r'\\1\\2', text)
    
        # Standard Unicode Normalization (NFKC)
        text = unicodedata.normalize('NFKC', text)"""
content = content.replace(old_stage_0, new_stage_0)

# 5. STAGE 1.5 Glossary
old_glossary = """        for k_word, e_word in kannada_map.items():
            text = text.replace(k_word, f" {e_word} ")"""
new_glossary = """        if use_v2:
            text = apply_glossary(text, kannada_map)
        else:
            for k_word, e_word in kannada_map.items():
                text = text.replace(k_word, f" {e_word} ")"""
content = content.replace(old_glossary, new_glossary)

# 6. STAGE 2 & 2.5 Translation and quality report
old_stage_2 = """    # ==========================================
    # STAGE 2: Efficient Translation (Google Translate Backend)
    # ==========================================
    translated_text = text
    if source_language.lower() != "en":
        try:
            translator = GoogleTranslator(source='auto', target='en')
            max_len = 1000 
            translated_chunks = []
            text_chunks = [text[i:i+max_len] for i in range(0, len(text), max_len)]
            
            for chunk in text_chunks:
                if chunk.strip():
                    try:
                        res = translator.translate(chunk)
                        if res and ("That's an error" in res or "That’s all we know" in res or "Error 500" in res or "Error 429" in res):
                            print("[AI Engine] Google Translate rate limit or server error detected. Falling back to raw chunk.")
                            translated_chunks.append(chunk)
                        else:
                            translated_chunks.append(res if res else chunk)
                    except Exception as chunk_err:
                        print("Chunk Translation Error:", chunk_err)
                        translated_chunks.append(chunk)
            
            translated_text = ''.join(translated_chunks)
        except Exception as e:
            print("Translation Error:", e)
            translated_text = text

    # ==========================================
    # STAGE 2.5: Domain-Specific Post-Editing & Noise Stripping
    # ==========================================
    if source_language.lower() != "en":
        translated_text = re.sub(r'(?i)\\bFinance Minister\\b', 'Owner', translated_text)
        translated_text = re.sub(r'(?i)\\bFinancer\\b', 'Owner', translated_text)
        translated_text = re.sub(r'(?i)\\bSecond Class\\b', 'Tenant', translated_text)
        translated_text = re.sub(r'[\\u0C80-\\u0CFF]+', '', translated_text)"""

new_stage_2 = """    # ==========================================
    # STAGE 2: Efficient Translation (Google Translate Backend)
    # ==========================================
    translated_text = text
    translation_quality = {}
    if source_language.lower() != "en":
        if use_v2:
            report = kannada_quality_report(sanitized_regional_text)
            translation_quality.update(report)
            try:
                translator = GoogleTranslator(source='auto', target='en')
                chunks = split_for_translation(text, max_len=1000)
                translation_quality["total_chunks"] = len(chunks)
                results, failed_indices = translate_with_retry(chunks, translator, retries=3, backoff=2)
                translation_quality["failed_chunks"] = len(failed_indices)
                translated_text = ''.join(results)
            except Exception as e:
                print("Translation Error (V2):", e)
                translated_text = text
                translation_quality["failed_chunks"] = translation_quality.get("total_chunks", 1)
        else:
            try:
                translator = GoogleTranslator(source='auto', target='en')
                max_len = 1000 
                translated_chunks = []
                text_chunks = [text[i:i+max_len] for i in range(0, len(text), max_len)]
                
                for chunk in text_chunks:
                    if chunk.strip():
                        try:
                            res = translator.translate(chunk)
                            if res and ("That's an error" in res or "That’s all we know" in res or "Error 500" in res or "Error 429" in res):
                                print("[AI Engine] Google Translate rate limit or server error detected. Falling back to raw chunk.")
                                translated_chunks.append(chunk)
                            else:
                                translated_chunks.append(res if res else chunk)
                        except Exception as chunk_err:
                            print("Chunk Translation Error:", chunk_err)
                            translated_chunks.append(chunk)
                
                translated_text = ''.join(translated_chunks)
            except Exception as e:
                print("Translation Error:", e)
                translated_text = text

    # ==========================================
    # STAGE 2.5: Domain-Specific Post-Editing & Noise Stripping
    # ==========================================
    if source_language.lower() != "en":
        translated_text = re.sub(r'(?i)\\bFinance Minister\\b', 'Owner', translated_text)
        translated_text = re.sub(r'(?i)\\bFinancer\\b', 'Owner', translated_text)
        translated_text = re.sub(r'(?i)\\bSecond Class\\b', 'Tenant', translated_text)
        if not use_v2:
            translated_text = re.sub(r'[\\u0C80-\\u0CFF]+', '', translated_text)"""
content = content.replace(old_stage_2, new_stage_2)

# 7. Add translation_quality to response
old_return = """    return DocumentResponse(
        original_length=original_length,
        raw_text=raw_text,
        sanitized_regional_text=sanitized_regional_text,
        translated_text=translated_text,
        anonymized_text=final_text,
        pii_entities=pii_entities,
        structure=structure_data,
        classification=classification_result,
        risk_analysis=risk_analysis_results,
        summary_output=summary_output_data
    )"""
new_return = """    return DocumentResponse(
        original_length=original_length,
        raw_text=raw_text,
        sanitized_regional_text=sanitized_regional_text,
        translated_text=translated_text,
        anonymized_text=final_text,
        pii_entities=pii_entities,
        structure=structure_data,
        classification=classification_result,
        risk_analysis=risk_analysis_results,
        summary_output=summary_output_data,
        translation_quality=translation_quality if use_v2 else {}
    )"""
content = content.replace(old_return, new_return)

with open("main.py", "w", encoding="utf-8") as f:
    f.write(content)
