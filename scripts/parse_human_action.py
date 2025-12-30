#!/usr/bin/env python3
"""
Parse Human Action by Ludwig von Mises into structured chapters and sections
for use in a chatbot/RAG system.

This version uses a cleaner approach - parsing the whole book into chapters
first, then into meaningful chunks for embedding/search.
"""

import re
import os
import json
from pathlib import Path

BOOK_STRUCTURE = {
    "parts": [
        {"number": 1, "title": "Human Action", "chapters": list(range(1, 8))},
        {"number": 2, "title": "Action Within the Framework of Society", "chapters": list(range(8, 14))},
        {"number": 3, "title": "Economic Calculation", "chapters": list(range(14, 17))},
        {"number": 4, "title": "Catallactics or Economics of the Market Society", "chapters": list(range(17, 25))},
        {"number": 5, "title": "Social Cooperation Without a Market", "chapters": list(range(25, 27))},
        {"number": 6, "title": "The Hampered Market Economy", "chapters": list(range(27, 36))},
        {"number": 7, "title": "The Place of Economics in Society", "chapters": list(range(36, 40))}
    ]
}

CHAPTER_TITLES = {
    1: "Acting Man",
    2: "The Epistemological Problems of the Sciences of Human Action",
    3: "Economics and the Revolt Against Reason",
    4: "A First Analysis of the Category of Action",
    5: "Time",
    6: "Uncertainty",
    7: "Action Within the World",
    8: "Human Society",
    9: "The Role of Ideas",
    10: "Exchange Within Society",
    11: "Valuation Without Calculation",
    12: "The Sphere of Economic Calculation",
    13: "Monetary Calculation as a Tool of Action",
    14: "The Scope and Method of Catallactics",
    15: "The Market",
    16: "Prices",
    17: "Indirect Exchange",
    18: "Action in the Passing of Time",
    19: "The Rate of Interest",
    20: "Interest, Credit Expansion, and the Trade Cycle",
    21: "Work and Wages",
    22: "The Nonhuman Original Factors of Production",
    23: "The Data of the Market",
    24: "Harmony and Conflict of Interests",
    25: "The Imaginary Construction of a Socialist Society",
    26: "The Impossibility of Economic Calculation Under Socialism",
    27: "The Government and the Market",
    28: "Interference by Taxation",
    29: "Restriction of Production",
    30: "Interference with the Structure of Prices",
    31: "Currency and Credit Manipulation",
    32: "Confiscation and Redistribution",
    33: "Syndicalism and Corporativism",
    34: "The Economics of War",
    35: "The Welfare Principle Versus the Market Principle",
    36: "The Crisis of Interventionism",
    37: "The Nondescript Character of Economics",
    38: "The Place of Economics in Learning",
    39: "Economics and the Essential Problems of Human Existence"
}

def roman_to_int(roman):
    """Convert Roman numeral to integer."""
    roman_values = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000}
    result = 0
    prev = 0
    for char in reversed(roman.upper()):
        curr = roman_values.get(char, 0)
        if curr < prev:
            result -= curr
        else:
            result += curr
        prev = curr
    return result

def int_to_roman(num):
    """Convert integer to Roman numeral."""
    val = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1]
    syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I']
    roman_num = ''
    for i, v in enumerate(val):
        while num >= v:
            roman_num += syms[i]
            num -= v
    return roman_num

def get_part_for_chapter(chapter_num):
    """Get the part number and title for a given chapter."""
    for part in BOOK_STRUCTURE["parts"]:
        if chapter_num in part["chapters"]:
            return part["number"], part["title"]
    return None, None

def slugify(text):
    """Convert text to a URL-friendly slug."""
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '_', text)
    return text.strip('_')[:60]

def clean_text(text):
    """Clean up OCR artifacts from text."""
    # Remove page numbers that appear alone on lines
    text = re.sub(r'\n\s*\d{1,4}\s*\n', '\n', text)
    # Remove roman numerals appearing alone (page numbers)
    text = re.sub(r'\n\s*[ivxlc]+\s*\n', '\n', text, flags=re.IGNORECASE)
    # Clean up multiple newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Fix common OCR errors
    text = text.replace('T h e', 'The')
    text = text.replace('t h e', 'the')
    text = text.replace(' ,', ',')
    return text.strip()

def chunk_text(text, chunk_size=2000, overlap=200):
    """Split text into overlapping chunks for embedding."""
    words = text.split()
    chunks = []
    start = 0

    while start < len(words):
        end = start + chunk_size
        chunk = ' '.join(words[start:end])
        chunks.append(chunk)
        start = end - overlap

    return chunks

def parse_human_action(input_file, output_dir):
    """Parse the Human Action text file and create structured output."""

    with open(input_file, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    chapters_dir = output_path / "chapters"
    chapters_dir.mkdir(exist_ok=True)

    chunks_dir = output_path / "chunks"
    chunks_dir.mkdir(exist_ok=True)

    all_chapters = []
    all_chunks = []

    # Find chapters using the pattern "Chapter X." where X is a Roman numeral
    # Match only valid chapter patterns (I through XXXIX)
    chapter_pattern = re.compile(
        r'Chapter\s+(I{1,3}|IV|V|VI{0,3}|IX|X{1,3}|XI{1,3}|XIV|XV|XVI{0,3}|XIX|XX{1,3}|XXI{1,3}|XXIV|XXV|XXVI{0,3}|XXIX|XXX{1,3}|XXXI{1,3}|XXXIV|XXXV|XXXVI{0,3}|XXXIX)\.\s*([A-Z][^\n]+)',
        re.IGNORECASE
    )

    # Find all chapters
    chapter_matches = list(chapter_pattern.finditer(content))

    # Keep only unique chapters (by Roman numeral)
    seen_chapters = {}
    unique_matches = []
    for match in chapter_matches:
        roman = match.group(1).upper()
        num = roman_to_int(roman)
        if num not in seen_chapters and num <= 39:
            seen_chapters[num] = match
            unique_matches.append(match)

    # Sort by position in text
    unique_matches.sort(key=lambda m: m.start())

    print(f"Found {len(unique_matches)} unique chapters")

    for i, match in enumerate(unique_matches):
        roman_num = match.group(1).upper()
        chapter_num = roman_to_int(roman_num)

        if chapter_num > 39:
            continue

        chapter_title = CHAPTER_TITLES.get(chapter_num, match.group(2).strip())
        part_num, part_title = get_part_for_chapter(chapter_num)

        # Get chapter content
        start_pos = match.end()
        if i + 1 < len(unique_matches):
            end_pos = unique_matches[i + 1].start()
        else:
            # Find the index which typically starts after chapter 39
            index_start = content.find('\nIndex\n', start_pos)
            if index_start == -1:
                index_start = content.find('\nINDEX\n', start_pos)
            end_pos = index_start if index_start != -1 else len(content)

        chapter_content = clean_text(content[start_pos:end_pos])

        # Skip if chapter content is too short (likely a parsing error)
        if len(chapter_content) < 500:
            print(f"  Skipping Chapter {chapter_num} - too short ({len(chapter_content)} chars)")
            continue

        # Save full chapter
        chapter_slug = f"chapter_{chapter_num:02d}_{slugify(chapter_title)}"
        chapter_file = chapters_dir / f"{chapter_slug}.md"

        chapter_header = f"""# Chapter {chapter_num}: {chapter_title}

**Book:** Human Action: A Treatise on Economics
**Author:** Ludwig von Mises
**Part {part_num}:** {part_title}

---

"""
        with open(chapter_file, 'w', encoding='utf-8') as f:
            f.write(chapter_header + chapter_content)

        chapter_meta = {
            "chapter_number": chapter_num,
            "chapter_roman": roman_num,
            "chapter_title": chapter_title,
            "part_number": part_num,
            "part_title": part_title,
            "file_path": str(chapter_file.relative_to(output_path)),
            "word_count": len(chapter_content.split()),
            "char_count": len(chapter_content)
        }
        all_chapters.append(chapter_meta)

        # Create chunks for this chapter
        chunks = chunk_text(chapter_content, chunk_size=1500, overlap=150)

        for j, chunk in enumerate(chunks):
            chunk_id = f"ch{chapter_num:02d}_chunk{j:03d}"
            chunk_file = chunks_dir / f"{chunk_id}.txt"

            chunk_header = f"""[Chapter {chapter_num}: {chapter_title}]
[Part {part_num}: {part_title}]
[Chunk {j+1} of {len(chunks)}]

"""
            with open(chunk_file, 'w', encoding='utf-8') as f:
                f.write(chunk_header + chunk)

            chunk_meta = {
                "chunk_id": chunk_id,
                "chapter_number": chapter_num,
                "chapter_title": chapter_title,
                "part_number": part_num,
                "part_title": part_title,
                "chunk_index": j,
                "total_chunks": len(chunks),
                "file_path": str(chunk_file.relative_to(output_path)),
                "word_count": len(chunk.split())
            }
            all_chunks.append(chunk_meta)

        print(f"Chapter {chapter_num}: {chapter_title} ({len(chunks)} chunks, {len(chapter_content.split())} words)")

    # Create master index
    index = {
        "title": "Human Action: A Treatise on Economics",
        "author": "Ludwig von Mises",
        "publication_year": 1949,
        "total_chapters": len(all_chapters),
        "total_chunks": len(all_chunks),
        "parts": BOOK_STRUCTURE["parts"],
        "chapters": all_chapters,
        "chunks": all_chunks
    }

    with open(output_path / "index.json", 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=2)

    # Create a summary file
    summary = f"""# Human Action - Parsed Content

**Author:** Ludwig von Mises
**Total Chapters:** {len(all_chapters)}
**Total Chunks:** {len(all_chunks)} (for embedding/search)

## Structure

"""
    for part in BOOK_STRUCTURE["parts"]:
        summary += f"\n### Part {part['number']}: {part['title']}\n\n"
        for ch in all_chapters:
            if ch["part_number"] == part["number"]:
                summary += f"- Chapter {ch['chapter_number']}: {ch['chapter_title']} ({ch['word_count']} words)\n"

    with open(output_path / "README.md", 'w', encoding='utf-8') as f:
        f.write(summary)

    print(f"\n{'='*60}")
    print(f"Done! Parsed Human Action into:")
    print(f"  - {len(all_chapters)} full chapter files in /chapters")
    print(f"  - {len(all_chunks)} chunk files in /chunks (for chatbot/RAG)")
    print(f"  - index.json with full metadata")
    print(f"  - README.md with structure overview")
    print(f"{'='*60}")

    return index

if __name__ == "__main__":
    import sys
    input_file = sys.argv[1] if len(sys.argv) > 1 else "human-action.txt"
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "content"
    parse_human_action(input_file, output_dir)
