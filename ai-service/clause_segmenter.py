import re

def segment_clauses(text: str):
    # Ensure text starts with newline so regexes match the first clause
    if not text.startswith('\n'):
        text = '\n' + text
        
    # 1. Clean page markers
    text = re.sub(r'--- PAGE \d+ ---', '\n', text)
    
    # Define candidate regex patterns for different numbering styles.
    # Group 1: Numbering, Group 2: Header text (first line)
    patterns = {
        "arabic_dot": r'\n\s*(\d+)\.\s+([^\n]+)',                     # 1. Heading
        "arabic_decimal": r'\n\s*(\d+\.\d+)\s+([^\n]+)',              # 1.1 Heading
        "arabic_paren": r'\n\s*\(?(\d+)\)\s+([^\n]+)',                # 1) or (1)
        "alpha_paren": r'\n\s*\(([a-zA-Zivx]+)\)\s+([^\n]+)',         # (a) or (i)
        "alpha_paren_right": r'\n\s*([a-zA-Zivx]+)\)\s+([^\n]+)',     # a) or i)
        "clause_n": r'(?i)\n\s*(?:Clause|Section|Article)\s+((?:[IVXLCDM]+|\d+))[:.-]?\s*([^\n]*)', # Clause 1, Article I
        "roman": r'\n\s*([IVXLCDM]+)[\.)]\s+([^\n]+)',                # I. or I)
        "arabic_alone": r'\n\s*(\d+)\s*\n\s*([^\n]+)',                # 1 \n Heading
        "all_caps": r'\n\s*([A-Z\s,]{5,40})\n',                       # ALL CAPS HEADING on its own line
        "recitals": r'(?i)\n\s*(WHEREAS[^\n]*|NOW THEREFORE[^\n]*)',  # WHEREAS clauses
        "kannada": r'\n\s*([೦-೯]+)[\.)]\s+([^\n]+)',                   # ೧. Heading
    }

    best_pattern_key = None
    best_matches = []
    
    # Extract WHEREAS recitals and ALL_CAPS headers if present, but we mainly want a primary numbered sequence.
    # We evaluate patterns by the number of matches they yield.
    for key, pat in patterns.items():
        if key in ["all_caps", "recitals"]: 
            continue
        matches = list(re.finditer(pat, text))
        if len(matches) >= 2:
            # simple heuristic: prefer the pattern with the most sequential matches
            if not best_matches or len(matches) > len(best_matches):
                best_matches = matches
                best_pattern_key = key
                
    # If no numbered scheme found, try all_caps
    if not best_matches:
        best_matches = list(re.finditer(patterns["all_caps"], text))
        best_pattern_key = "all_caps"
        
    dominant_matches = best_matches

    # Also find recitals and standalone ALL CAPS (like "SCHEDULE A")
    extra_matches = []
    for m in re.finditer(patterns["recitals"], text):
        extra_matches.append(m)
        
    for m in re.finditer(patterns["all_caps"], text):
        header_text = m.group(1).strip()
        if header_text.upper() in ["SCHEDULE", "ANNEXURE"] or "SCHEDULE " in header_text.upper() or "ANNEXURE " in header_text.upper():
            extra_matches.append(m)
        elif best_pattern_key is None and len(header_text.split()) < 8:
            extra_matches.append(m)

    # Combine and sort all boundaries by start index
    all_boundaries = dominant_matches + extra_matches
    unique_boundaries = {m.start(): m for m in all_boundaries}
    sorted_boundaries = sorted(unique_boundaries.values(), key=lambda m: m.start())

    if not sorted_boundaries:
        # Fallback to paragraph splitting
        paragraphs = [p.strip() for p in re.split(r'\n{2,}|\.\s+(?=[A-Z0-9])', text) if p.strip()]
        if not paragraphs:
            paragraphs = [text.strip()]
        clauses = []
        for idx, p in enumerate(paragraphs):
            clauses.append({
                "clauseIndex": idx + 1,
                "clauseHeader": "General Paragraph" if idx == 0 and len(paragraphs) == 1 else f"Section {idx + 1}",
                "rawText": p,
                "sanitizedText": p,
                "detectedType": "General Covenants",
                "jurisdiction": {"country": "India", "state": None, "governingLawClausePresent": False}
            })
        return clauses

    # Build clauses from boundaries
    clauses = []
    clause_index = 1
    
    for i, match in enumerate(sorted_boundaries):
        start = match.start()
        end = sorted_boundaries[i+1].start() if i + 1 < len(sorted_boundaries) else len(text)
        
        clause_text = text[start:end].strip()
        
        raw_match_text = match.group(0).strip()
        if "WHEREAS" in raw_match_text.upper() or "NOW THEREFORE" in raw_match_text.upper():
            clause_header = raw_match_text.split('\n')[0].strip()
            if len(clause_header) > 50:
                clause_header = clause_header[:50] + "..."
        elif match.re.pattern == patterns["all_caps"]:
            clause_header = match.group(1).strip()
        else:
            if len(match.groups()) >= 2:
                num = match.group(1)
                heading_text = match.group(2).strip()
                clause_header = f"{num}. {heading_text}" if heading_text else f"Clause {num}"
            else:
                clause_header = f"Clause {clause_index}"
                
        # Sub-item splitting for over-long clauses
        if len(clause_text) > 40: 
            sub_patterns = [r'\n\s*(\d+\.\d+)\s+([^\n]+)', r'\n\s*\(([a-zivx]+)\)\s+([^\n]+)']
            sub_matches = []
            for sp in sub_patterns:
                sm = list(re.finditer(sp, clause_text))
                if len(sm) >= 2:
                    sub_matches = sm
                    break
            
            if sub_matches:
                # Add parent clause first
                first_sub_start = sub_matches[0].start()
                parent_text = clause_text[:first_sub_start].strip()
                if parent_text:
                    clauses.append({
                        "clauseIndex": clause_index,
                        "clauseHeader": clause_header,
                        "rawText": parent_text,
                        "sanitizedText": parent_text,
                        "detectedType": "General Covenants",
                        "jurisdiction": {"country": "India", "state": None, "governingLawClausePresent": False}
                    })
                    clause_index += 1
                
                for j, sm in enumerate(sub_matches):
                    s_start = sm.start()
                    s_end = sub_matches[j+1].start() if j + 1 < len(sub_matches) else len(clause_text)
                    s_text = clause_text[s_start:s_end].strip()
                    s_header = f"{sm.group(1)} {sm.group(2).strip()}"
                    
                    clauses.append({
                        "clauseIndex": clause_index,
                        "clauseHeader": s_header,
                        "rawText": s_text,
                        "sanitizedText": s_text,
                        "detectedType": "General Covenants",
                        "jurisdiction": {"country": "India", "state": None, "governingLawClausePresent": False}
                    })
                    clause_index += 1
                continue
                
        clauses.append({
            "clauseIndex": clause_index,
            "clauseHeader": clause_header,
            "rawText": clause_text,
            "sanitizedText": clause_text,
            "detectedType": "General Covenants",
            "jurisdiction": {"country": "India", "state": None, "governingLawClausePresent": False}
        })
        clause_index += 1

    return clauses
