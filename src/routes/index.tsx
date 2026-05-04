import { EditorProvider } from "~/molecules/EditorContext/EditorContext";
import { EditorTemplate } from "~/templates/EditorTemplate";
import { LexicalEditor } from "~/organisms/LexicalEditor/LexicalEditor";
import { EditorLayout } from "~/organisms/EditorLayout/EditorLayout";
import { Toolbar } from "~/organisms/LexicalEditor/LexicalToolbar";
import { NoSSR } from "~/atoms/NoSSR/NoSSR";
import { COMMENTS_EDITOR_CONFIG } from "../../config";
import "./index.scss";

export default function StartPage() {
  return (
    <EditorTemplate>
      <div class="editor-page">
        <NoSSR>
          <EditorProvider config={COMMENTS_EDITOR_CONFIG}>
            <EditorLayout toolbar={<Toolbar />}>
              <LexicalEditor />
            </EditorLayout>
          </EditorProvider>
        </NoSSR>
      </div>
    </EditorTemplate>
  );
}
