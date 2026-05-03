import { EditorProvider } from "~/molecules/LexicalEditor/useEditor";
import { LexicalEditor } from "~/organisms/LexicalEditor/LexicalEditor";
import { COMMENTS_EDITOR_CONFIG } from "../../config";
import { Layout } from "~/atoms/Layout/Layout";
import { Toolbar } from "~/organisms/LexicalEditor/LexicalToolbar";
import "./index.scss"
export default function StartPage() {
  return (<div class="rrrr"  >
    
    <EditorProvider config={COMMENTS_EDITOR_CONFIG}>
      <Layout toolbar=<Toolbar/>>
        <LexicalEditor></LexicalEditor>
      </Layout>
      </EditorProvider>
    
  </div>
    
    
  );
}
