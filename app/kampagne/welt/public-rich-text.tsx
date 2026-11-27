// Server-side reader for public rich text. The value already passed domain/public-world.ts (no images, no internal
// links); this renders only text structure, so no client bundle or editor code reaches the public page.
import type { ReactNode } from "react";
import { readRichText, type RichTextBlock, type RichTextInline } from "@/domain/location-rich-text";
import styles from "./welt.module.css";

function inline(parts: RichTextInline[], key: string): ReactNode[] {
  return parts.map((part, index) => {
    let node: ReactNode = part.text;
    if (part.bold) node = <strong>{node}</strong>;
    if (part.italic) node = <em>{node}</em>;
    if (part.underline) node = <u>{node}</u>;
    if (part.strike) node = <s>{node}</s>;
    if (part.href && /^(https?:|mailto:)/i.test(part.href)) node = <a href={part.href} target="_blank" rel="noopener noreferrer nofollow">{node}</a>;
    return <span key={key + "-" + index}>{node}</span>;
  });
}

function blocks(list: RichTextBlock[], key: string): ReactNode[] {
  return list.map((block, index) => {
    const id = key + "-" + index;
    switch (block.type) {
      case "heading2": return <h4 key={id}>{inline(block.children, id)}</h4>;
      case "heading3": return <h5 key={id}>{inline(block.children, id)}</h5>;
      case "quote": return <blockquote key={id}>{inline(block.children, id)}</blockquote>;
      case "bulletList": return <ul key={id}>{block.items.map((item, itemIndex) => <li key={id + "-" + itemIndex}>{inline(item, id + "-" + itemIndex)}</li>)}</ul>;
      case "orderedList": return <ol key={id}>{block.items.map((item, itemIndex) => <li key={id + "-" + itemIndex}>{inline(item, id + "-" + itemIndex)}</li>)}</ol>;
      case "table": return <div key={id} className={styles.tableWrap}><table><tbody>{block.rows.map((row, rowIndex) => <tr key={id + "-" + rowIndex}>{row.map((cell, cellIndex) => block.header && rowIndex === 0
        ? <th key={cellIndex} scope="col">{inline(cell, id + "-" + rowIndex + "-" + cellIndex)}</th>
        : <td key={cellIndex}>{inline(cell, id + "-" + rowIndex + "-" + cellIndex)}</td>)}</tr>)}</tbody></table></div>;
      case "details": return <details key={id}><summary>{block.summary}</summary>{blocks(block.content.blocks, id)}</details>;
      case "divider": return <hr key={id} />;
      case "image": return null;
      default: return block.children.some(part => part.text.trim()) ? <p key={id}>{inline(block.children, id)}</p> : null;
    }
  });
}

export function PublicRichText({ value, className }: { value: string; className?: string }) {
  if (!value) return null;
  return <div className={[styles.prose, className].filter(Boolean).join(" ")}>{blocks(readRichText(value).blocks, "rt")}</div>;
}
