import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    editorRef.current?.focus();
    // trigger change
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleFontSize = (size: string) => {
    // execCommand fontSize uses 1-7 scale
    exec("fontSize", size);
  };

  return (
    <div className="border border-input rounded-md overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-border bg-muted/30">
        {/* Font Size */}
        <Select onValueChange={handleFontSize} defaultValue="3">
          <SelectTrigger className="h-7 w-[90px] text-xs">
            <SelectValue placeholder="Ukuran" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Sangat Kecil</SelectItem>
            <SelectItem value="2">Kecil</SelectItem>
            <SelectItem value="3">Normal</SelectItem>
            <SelectItem value="4">Sedang</SelectItem>
            <SelectItem value="5">Besar</SelectItem>
            <SelectItem value="6">Sangat Besar</SelectItem>
            <SelectItem value="7">Jumbo</SelectItem>
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Text Formatting */}
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec("bold")} title="Bold">
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec("italic")} title="Italic">
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec("underline")} title="Underline">
          <Underline className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec("strikeThrough")} title="Strikethrough">
          <Strikethrough className="h-3.5 w-3.5" />
        </Button>

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Lists */}
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec("insertUnorderedList")} title="Bullet List">
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec("insertOrderedList")} title="Numbered List">
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Alignment */}
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec("justifyLeft")} title="Align Left">
          <AlignLeft className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec("justifyCenter")} title="Align Center">
          <AlignCenter className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec("justifyRight")} title="Align Right">
          <AlignRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        className="min-h-[120px] max-h-[300px] overflow-y-auto p-3 text-sm focus:outline-none prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5"
        onInput={handleInput}
        dangerouslySetInnerHTML={{ __html: value }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          opacity: 0.5;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
