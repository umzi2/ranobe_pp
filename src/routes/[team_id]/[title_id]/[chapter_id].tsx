import { useParams } from "@solidjs/router";
import { EditorProvider } from "~/molecules/EditorContext/EditorContext";
import { EditorTemplate } from "~/templates/EditorTemplate";
import { LexicalEditor } from "~/organisms/LexicalEditor/LexicalEditor";
import { EditorLayout } from "~/organisms/EditorLayout/EditorLayout";
import { Toolbar } from "~/organisms/LexicalEditor/LexicalToolbar";
import { NoSSR } from "~/atoms/NoSSR/NoSSR";
import { COMMENTS_EDITOR_CONFIG } from "../../../../config";
import "../../index.scss";

export default function ChapterPage() {
  const params = useParams<{
    team_id: string;
    title_id: string;
    chapter_id: string;
  }>();

  const chapterParams = {
    teamId: Number(params.team_id),
    titleId: Number(params.title_id),
    chapterId: Number(params.chapter_id),
  };

  return (
    <EditorTemplate>
      <div class="editor-page">
        {/*<div class="editor-page__breadcrumb">
          Team: {params.team_id} / Title: {params.title_id} / Chapter:{" "}
          {params.chapter_id}
        </div>*/}
        <NoSSR>
          <EditorProvider config={COMMENTS_EDITOR_CONFIG}>
            <EditorLayout toolbar={<Toolbar />}>
              <LexicalEditor chapterParams={chapterParams} />
            </EditorLayout>
          </EditorProvider>
        </NoSSR>
      </div>
    </EditorTemplate>
  );
}
