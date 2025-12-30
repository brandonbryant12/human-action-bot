#!/usr/bin/env python3
"""
Download Human Action chapters from Econlib.org and structure for chatbot use.
"""

import urllib.request
import urllib.error
import json
import re
import os
import time
from pathlib import Path
from html.parser import HTMLParser

# Chapter metadata
CHAPTERS = [
    {"num": 1, "title": "Foreword to Fourth Edition", "part": 0, "chapter": 0},
    {"num": 2, "title": "Foreword to Third Edition", "part": 0, "chapter": 0},
    {"num": 3, "title": "Introduction", "part": 0, "chapter": 0},
    {"num": 4, "title": "Acting Man", "part": 1, "chapter": 1},
    {"num": 5, "title": "The Epistemological Problems of the Sciences of Human Action", "part": 1, "chapter": 2},
    {"num": 6, "title": "Economics and the Revolt Against Reason", "part": 1, "chapter": 3},
    {"num": 7, "title": "A First Analysis of the Category of Action", "part": 1, "chapter": 4},
    {"num": 8, "title": "Time", "part": 1, "chapter": 5},
    {"num": 9, "title": "Uncertainty", "part": 1, "chapter": 6},
    {"num": 10, "title": "Action Within the World", "part": 1, "chapter": 7},
    {"num": 11, "title": "Human Society", "part": 2, "chapter": 8},
    {"num": 12, "title": "The Role of Ideas", "part": 2, "chapter": 9},
    {"num": 13, "title": "Exchange Within Society", "part": 2, "chapter": 10},
    {"num": 14, "title": "Valuation Without Calculation", "part": 3, "chapter": 11},
    {"num": 15, "title": "The Sphere of Economic Calculation", "part": 3, "chapter": 12},
    {"num": 16, "title": "Monetary Calculation as a Tool of Action", "part": 3, "chapter": 13},
    {"num": 17, "title": "The Scope and Method of Catallactics", "part": 4, "chapter": 14},
    {"num": 18, "title": "The Market", "part": 4, "chapter": 15},
    {"num": 19, "title": "Prices", "part": 4, "chapter": 16},
    {"num": 20, "title": "Indirect Exchange", "part": 4, "chapter": 17},
    {"num": 21, "title": "Action in the Passing of Time", "part": 4, "chapter": 18},
    {"num": 22, "title": "The Rate of Interest", "part": 4, "chapter": 19},
    {"num": 23, "title": "Interest, Credit Expansion, and the Trade Cycle", "part": 4, "chapter": 20},
    {"num": 24, "title": "Work and Wages", "part": 4, "chapter": 21},
    {"num": 25, "title": "The Nonhuman Original Factors of Production", "part": 4, "chapter": 22},
    {"num": 26, "title": "The Data of the Market", "part": 4, "chapter": 23},
    {"num": 27, "title": "Harmony and Conflict of Interests", "part": 4, "chapter": 24},
    {"num": 28, "title": "The Imaginary Construction of a Socialist Society", "part": 5, "chapter": 25},
    {"num": 29, "title": "The Impossibility of Economic Calculation Under Socialism", "part": 5, "chapter": 26},
    {"num": 30, "title": "The Government and the Market", "part": 6, "chapter": 27},
    {"num": 31, "title": "Interference by Taxation", "part": 6, "chapter": 28},
    {"num": 32, "title": "Restriction of Production", "part": 6, "chapter": 29},
    {"num": 33, "title": "Interference with the Structure of Prices", "part": 6, "chapter": 30},
    {"num": 34, "title": "Currency and Credit Manipulation", "part": 6, "chapter": 31},
    {"num": 35, "title": "Confiscation and Redistribution", "part": 6, "chapter": 32},
    {"num": 36, "title": "Syndicalism and Corporativism", "part": 6, "chapter": 33},
    {"num": 37, "title": "The Economics of War", "part": 6, "chapter": 34},
    {"num": 38, "title": "The Welfare Principle Versus the Market Principle", "part": 6, "chapter": 35},
    {"num": 39, "title": "The Crisis of Interventionism", "part": 6, "chapter": 36},
    {"num": 40, "title": "The Nondescript Character of Economics", "part": 7, "chapter": 37},
    {"num": 41, "title": "The Place of Economics in Learning", "part": 7, "chapter": 38},
    {"num": 42, "title": "Economics and the Essential Problems of Human Existence", "part": 7, "chapter": 39},
]

PART_TITLES = {
    0: "Front Matter",
    1: "Human Action",
    2: "Action Within the Framework of Society",
    3: "Economic Calculation",
    4: "Catallactics or Economics of the Market Society",
    5: "Social Cooperation Without a Market",
    6: "The Hampered Market Economy",
    7: "The Place of Economics in Society",
}

class TextExtractor(HTMLParser):
    """Extract text content from HTML, preserving paragraph structure."""

    def __init__(self):
        super().__init__()
        self.text_parts = []
        self.current_text = []
        self.in_content = False
        self.skip_tags = {'script', 'style', 'nav', 'header', 'footer', 'noscript'}
        self.block_tags = {'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'br'}
        self.tag_stack = []

    def handle_starttag(self, tag, attrs):
        self.tag_stack.append(tag)
        if tag in self.skip_tags:
            return
        if tag in self.block_tags and self.current_text:
            self.text_parts.append(' '.join(self.current_text))
            self.current_text = []

    def handle_endtag(self, tag):
        if self.tag_stack and self.tag_stack[-1] == tag:
            self.tag_stack.pop()
        if tag in self.block_tags and self.current_text:
            self.text_parts.append(' '.join(self.current_text))
            self.current_text = []

    def handle_data(self, data):
        # Skip if we're inside a skip tag
        if any(t in self.skip_tags for t in self.tag_stack):
            return
        text = data.strip()
        if text:
            self.current_text.append(text)

    def get_text(self):
        if self.current_text:
            self.text_parts.append(' '.join(self.current_text))
        return '\n\n'.join(p for p in self.text_parts if p.strip())


def extract_text_from_html(html_content):
    """Extract clean text from HTML content."""
    # Try to find the main content area
    # Look for content between common markers

    # First, try to extract just the book content
    content_markers = [
        (r'<div[^>]*class="[^"]*book-content[^"]*"[^>]*>(.*?)</div>', re.DOTALL),
        (r'<article[^>]*>(.*?)</article>', re.DOTALL),
        (r'<main[^>]*>(.*?)</main>', re.DOTALL),
        (r'<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)</div>', re.DOTALL),
    ]

    content = html_content
    for pattern, flags in content_markers:
        match = re.search(pattern, html_content, flags)
        if match:
            content = match.group(1)
            break

    # Parse HTML and extract text
    parser = TextExtractor()
    try:
        parser.feed(content)
    except:
        # Fallback: simple regex-based extraction
        # Remove script and style tags
        content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r'<style[^>]*>.*?</style>', '', content, flags=re.DOTALL | re.IGNORECASE)
        # Remove HTML tags
        content = re.sub(r'<[^>]+>', ' ', content)
        # Clean up whitespace
        content = re.sub(r'\s+', ' ', content)
        return content.strip()

    return parser.get_text()


def download_chapter(chapter_num, output_dir, max_retries=3):
    """Download a single chapter from Econlib with retries."""
    url = f"https://www.econlib.org/library/Mises/HmA/msHmA.html?chapter_num={chapter_num}"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }

    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=60) as response:
                html_content = response.read().decode('utf-8', errors='replace')
            return html_content
        except (urllib.error.URLError, TimeoutError, Exception) as e:
            if attempt < max_retries - 1:
                print(f"retry {attempt + 1}...", end=" ", flush=True)
                time.sleep(2)
            else:
                print(f"  Error downloading chapter {chapter_num}: {e}")
                return None
    return None


def slugify(text):
    """Convert text to a URL-friendly slug."""
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '_', text)
    return text.strip('_')[:60]


def chunk_text(text, chunk_size=1500, overlap=150):
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


def main():
    output_dir = Path("content")
    output_dir.mkdir(exist_ok=True)

    chapters_dir = output_dir / "chapters"
    chapters_dir.mkdir(exist_ok=True)

    chunks_dir = output_dir / "chunks"
    chunks_dir.mkdir(exist_ok=True)

    all_chapters = []
    all_chunks = []

    print("Downloading Human Action from Econlib.org...")
    print("=" * 60)

    for ch_info in CHAPTERS:
        chapter_num = ch_info["num"]
        title = ch_info["title"]
        part = ch_info["part"]
        chapter = ch_info["chapter"]
        part_title = PART_TITLES[part]

        # Check if already downloaded
        if chapter > 0:
            filename = f"chapter_{chapter:02d}_{slugify(title)}.md"
        else:
            filename = f"{slugify(title)}.md"

        chapter_file = chapters_dir / filename
        if chapter_file.exists():
            # Read existing file to get word count
            with open(chapter_file, 'r') as f:
                existing_text = f.read()
            word_count = len(existing_text.split())
            print(f"Skipping {chapter_num}/42: {title} (already exists, {word_count} words)")

            # Still add to metadata
            chapter_meta = {
                "econlib_num": chapter_num,
                "chapter_number": chapter,
                "title": title,
                "part_number": part,
                "part_title": part_title,
                "file_path": str(chapter_file.relative_to(output_dir)),
                "word_count": word_count
            }
            all_chapters.append(chapter_meta)

            # Count existing chunks
            chunk_pattern = f"ch{chapter:02d}_chunk" if chapter > 0 else f"{slugify(title)[:10]}_chunk"
            existing_chunks = list(chunks_dir.glob(f"{chunk_pattern}*.txt"))
            for chunk_file_path in sorted(existing_chunks):
                with open(chunk_file_path, 'r') as f:
                    existing_chunk_text = f.read()
                chunk_meta = {
                    "chunk_id": chunk_file_path.stem,
                    "chapter_number": chapter,
                    "title": title,
                    "part_number": part,
                    "part_title": part_title,
                    "chunk_index": len([c for c in all_chunks if c["chapter_number"] == chapter]),
                    "total_chunks": len(existing_chunks),
                    "file_path": str(chunk_file_path.relative_to(output_dir)),
                    "word_count": len(existing_chunk_text.split())
                }
                all_chunks.append(chunk_meta)
            continue

        print(f"Downloading {chapter_num}/42: {title}...", end=" ", flush=True)

        html_content = download_chapter(chapter_num, output_dir)

        if not html_content:
            print("FAILED")
            continue

        # Extract text
        text = extract_text_from_html(html_content)

        if len(text) < 100:
            print(f"WARNING: Very short content ({len(text)} chars)")
            continue

        # Save chapter
        if chapter > 0:
            filename = f"chapter_{chapter:02d}_{slugify(title)}.md"
            header = f"""# Chapter {chapter}: {title}

**Book:** Human Action: A Treatise on Economics
**Author:** Ludwig von Mises
**Part {part}:** {part_title}

---

"""
        else:
            filename = f"{slugify(title)}.md"
            header = f"""# {title}

**Book:** Human Action: A Treatise on Economics
**Author:** Ludwig von Mises

---

"""

        chapter_file = chapters_dir / filename
        with open(chapter_file, 'w', encoding='utf-8') as f:
            f.write(header + text)

        word_count = len(text.split())

        chapter_meta = {
            "econlib_num": chapter_num,
            "chapter_number": chapter,
            "title": title,
            "part_number": part,
            "part_title": part_title,
            "file_path": str(chapter_file.relative_to(output_dir)),
            "word_count": word_count
        }
        all_chapters.append(chapter_meta)

        # Create chunks for this chapter
        chunks = chunk_text(text, chunk_size=1500, overlap=150)

        for j, chunk in enumerate(chunks):
            if chapter > 0:
                chunk_id = f"ch{chapter:02d}_chunk{j:03d}"
                chunk_header = f"[Chapter {chapter}: {title}]\n[Part {part}: {part_title}]\n[Chunk {j+1}/{len(chunks)}]\n\n"
            else:
                chunk_id = f"{slugify(title)[:10]}_chunk{j:03d}"
                chunk_header = f"[{title}]\n[Chunk {j+1}/{len(chunks)}]\n\n"

            chunk_file = chunks_dir / f"{chunk_id}.txt"
            with open(chunk_file, 'w', encoding='utf-8') as f:
                f.write(chunk_header + chunk)

            chunk_meta = {
                "chunk_id": chunk_id,
                "chapter_number": chapter,
                "title": title,
                "part_number": part,
                "part_title": part_title,
                "chunk_index": j,
                "total_chunks": len(chunks),
                "file_path": str(chunk_file.relative_to(output_dir)),
                "word_count": len(chunk.split())
            }
            all_chunks.append(chunk_meta)

        print(f"OK ({word_count} words, {len(chunks)} chunks)")

        # Be polite to the server
        time.sleep(0.5)

    # Create index
    index = {
        "title": "Human Action: A Treatise on Economics",
        "author": "Ludwig von Mises",
        "source": "Econlib.org",
        "total_chapters": len([c for c in all_chapters if c["chapter_number"] > 0]),
        "total_sections": len(all_chapters),
        "total_chunks": len(all_chunks),
        "parts": [{"number": k, "title": v} for k, v in PART_TITLES.items()],
        "chapters": all_chapters,
        "chunks": all_chunks
    }

    with open(output_dir / "index.json", 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=2)

    # Create README
    readme = f"""# Human Action - Structured Content

**Title:** Human Action: A Treatise on Economics
**Author:** Ludwig von Mises
**Source:** [Econlib.org](https://www.econlib.org/library/Mises/HmA/msHmA.html)

## Contents

- **{len(all_chapters)} sections** (including forewords, introduction, and 39 chapters)
- **{len(all_chunks)} chunks** optimized for chatbot/RAG systems (~1500 words each with overlap)

## Directory Structure

```
content/
├── chapters/      # Full chapter files in Markdown
├── chunks/        # Text chunks for embedding/search
├── index.json     # Complete metadata index
└── README.md      # This file
```

## Parts

"""

    for part_num, part_title in PART_TITLES.items():
        if part_num == 0:
            readme += f"\n### {part_title}\n\n"
        else:
            readme += f"\n### Part {part_num}: {part_title}\n\n"

        for ch in all_chapters:
            if ch["part_number"] == part_num:
                if ch["chapter_number"] > 0:
                    readme += f"- Chapter {ch['chapter_number']}: {ch['title']} ({ch['word_count']} words)\n"
                else:
                    readme += f"- {ch['title']} ({ch['word_count']} words)\n"

    with open(output_dir / "README.md", 'w', encoding='utf-8') as f:
        f.write(readme)

    print("\n" + "=" * 60)
    print("Download complete!")
    print(f"  - {len(all_chapters)} chapter files in content/chapters/")
    print(f"  - {len(all_chunks)} chunk files in content/chunks/")
    print(f"  - Index saved to content/index.json")
    print("=" * 60)


if __name__ == "__main__":
    main()
