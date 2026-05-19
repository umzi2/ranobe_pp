import { useParams, useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";
import {
  EditorProvider,
  useEditor,
} from "~/molecules/EditorContext/EditorContext";
import { EditorTemplate } from "~/templates/EditorTemplate";
import { LexicalEditor } from "~/organisms/LexicalEditor/LexicalEditor";
import { EditorLayout } from "~/organisms/EditorLayout/EditorLayout";
import { Toolbar } from "~/organisms/LexicalEditor/LexicalToolbar";
import { ProtoPreview } from "~/organisms/ProtoPreview/ProtoPreview";
import { NoSSR } from "~/atoms/NoSSR/NoSSR";
import { COMMENTS_EDITOR_CONFIG } from "../../../../config";
import { loadDocument, editEditor } from "~/gen/lexical-rpc";
import "../../index.scss";

function ChapterEditor({ id }: { id: bigint }) {
  const editor = useEditor();
  const navigate = useNavigate();
  const params = useParams<{ team_id: string; title_id: string }>();

  onMount(async () => {
    try {
      const lexicalJson = await loadDocument(id);
      const editorState = editor.parseEditorState(
        lexicalJson as unknown as Parameters<typeof editor.parseEditorState>[0],
      );
      editor.setEditorState(editorState);
    } catch (err) {
      console.error("Failed to load document:", err);
    }
  });

  const handleSave = async () => {
    try {
      await editEditor(editor, id);
      navigate(`/${params.team_id}/${params.title_id}`, { replace: true });
    } catch (err) {
      console.error("Failed to save document:", err);
    }
  };

  return (
    <>
      <EditorLayout toolbar={<Toolbar docId={id} />}>
        <LexicalEditor
          chapterParams={{
            teamId: Number(params.team_id),
            titleId: Number(params.title_id),
            chapterId: Number(id),
          }}
          onSave={handleSave}
        />
      </EditorLayout>
    </>
  );
}

export default function ChapterPage() {
  const params = useParams<{
    team_id: string;
    title_id: string;
    chapter_id: string;
  }>();

  const docId = BigInt(params.chapter_id);

  return (
    <EditorTemplate>
      <div class="editor-page">
        <NoSSR>
          <EditorProvider config={COMMENTS_EDITOR_CONFIG}>
            <ChapterEditor id={docId} />
          </EditorProvider>
        </NoSSR>
      </div>
    </EditorTemplate>
  );
}
