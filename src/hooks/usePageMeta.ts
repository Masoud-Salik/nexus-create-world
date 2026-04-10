import { useEffect } from "react";

interface PageMetaOptions {
  title: string;
  description?: string;
}

const BASE_TITLE = "StudyTime";

export function usePageMeta({ title, description }: PageMetaOptions) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${BASE_TITLE}` : BASE_TITLE;
    document.title = fullTitle;

    if (description) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement("meta");
        metaDesc.setAttribute("name", "description");
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute("content", description);
    }

    return () => {
      document.title = BASE_TITLE;
    };
  }, [title, description]);
}
