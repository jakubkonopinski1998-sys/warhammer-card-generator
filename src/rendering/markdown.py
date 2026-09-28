"""Parser Markdown → bloki gotowe do renderowania na obrazie."""
from dataclasses import dataclass, field
from typing import Literal


BlockType = Literal["h1", "h2", "h3", "paragraph", "bullet", "numbered", "quote", "hr"]


@dataclass
class Inline:
    text: str
    bold: bool = False
    italic: bool = False


@dataclass
class Block:
    type: BlockType
    runs: list[Inline] = field(default_factory=list)
    marker: str = ""  # np. "1." dla listy numerowanej


class MarkdownParser:
    @staticmethod
    def parse(text: str) -> list[Block]:
        blocks: list[Block] = []
        if not text:
            return blocks

        for raw_line in text.split("\n"):
            line = raw_line.rstrip()
            stripped = line.strip()

            if not stripped:
                continue

            if stripped == "---":
                blocks.append(Block(type="hr"))
                continue

            if stripped.startswith("### "):
                blocks.append(Block(type="h3", runs=MarkdownParser._inline(stripped[4:])))
            elif stripped.startswith("## "):
                blocks.append(Block(type="h2", runs=MarkdownParser._inline(stripped[3:])))
            elif stripped.startswith("# "):
                blocks.append(Block(type="h1", runs=MarkdownParser._inline(stripped[2:])))
            elif stripped.startswith("> "):
                blocks.append(Block(type="quote", runs=MarkdownParser._inline(stripped[2:])))
            elif stripped.startswith("- ") or stripped.startswith("* "):
                blocks.append(Block(type="bullet", runs=MarkdownParser._inline(stripped[2:])))
            elif MarkdownParser._is_numbered(stripped):
                marker, rest = MarkdownParser._split_numbered(stripped)
                blocks.append(Block(type="numbered", runs=MarkdownParser._inline(rest), marker=marker))
            else:
                blocks.append(Block(type="paragraph", runs=MarkdownParser._inline(stripped)))

        return blocks

    @staticmethod
    def _is_numbered(s: str) -> bool:
        i = 0
        while i < len(s) and s[i].isdigit():
            i += 1
        return i > 0 and i < len(s) and s[i] in ".)" and i + 1 < len(s) and s[i + 1] == " "

    @staticmethod
    def _split_numbered(s: str) -> tuple[str, str]:
        i = 0
        while i < len(s) and (s[i].isdigit() or s[i] in ".)"):
            i += 1
        return s[:i], s[i:].strip()

    @staticmethod
    def _inline(text: str) -> list[Inline]:
        """Parsuje **bold**, *italic*, ***bold-italic*** na listę fragmentów."""
        runs: list[Inline] = []
        i = 0
        buf = ""

        def flush():
            nonlocal buf
            if buf:
                runs.append(Inline(text=buf))
                buf = ""

        while i < len(text):
            # *** bold-italic ***
            if text[i:i+3] == "***":
                end = text.find("***", i + 3)
                if end != -1:
                    flush()
                    runs.append(Inline(text=text[i+3:end], bold=True, italic=True))
                    i = end + 3
                    continue

            # ** bold **
            if text[i:i+2] == "**":
                end = text.find("**", i + 2)
                if end != -1:
                    flush()
                    runs.append(Inline(text=text[i+2:end], bold=True))
                    i = end + 2
                    continue

            # * italic *
            if text[i] == "*":
                end = text.find("*", i + 1)
                if end != -1:
                    flush()
                    runs.append(Inline(text=text[i+1:end], italic=True))
                    i = end + 1
                    continue

            buf += text[i]
            i += 1

        flush()
        return runs