import { useParams, useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";
import { create } from "@bufbuild/protobuf";
import {
  DocumentSchema,
  NodeSchema,
  NodeType,
  CreateDocumetnRequestSchema,
} from "~/gen/document_pb";
import { saveClient } from "~/gen/lexical-rpc";
import { resolveApiKey, clearStoredApiKey } from "~/services/api-key";
import { ConnectError, Code } from "@connectrpc/connect";

export default function CreateChapterPage() {
  const params = useParams<{ team_id: string; title_id: string }>();
  const navigate = useNavigate();

  onMount(async () => {
    const apiKey = await resolveApiKey();

    // Создаём пустой документ
    const emptyDoc = create(DocumentSchema, {
      version: "1",
      meta: {},
      root: create(NodeSchema, {
        type: NodeType.NODE_ROOT,
        version: 1,
        children: [
          create(NodeSchema, {
            type: NodeType.NODE_PARAGRAPH,
            version: 1,
            children: [],
          }),
        ],
      }),
    });

    try {
      const req = create(CreateDocumetnRequestSchema, {
        apiKey,
        document: emptyDoc,
      });
      const res = await saveClient.save(req);
      navigate(`/${params.team_id}/${params.title_id}/${res.id}`, {
        replace: true,
      });
    } catch (err) {
      console.error("Failed to create document:", err);
      if (err instanceof ConnectError) {
        if (
          err.code === Code.Unauthenticated ||
          err.code === Code.PermissionDenied
        ) {
          clearStoredApiKey();
        }
      }
    }
  });

  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        height: "100vh",
        color: "#6b7280",
        "font-family": '"Tilda Sans", sans-serif',
        "font-size": "1rem",
      }}
    >
      Creating document…
    </div>
  );
}
