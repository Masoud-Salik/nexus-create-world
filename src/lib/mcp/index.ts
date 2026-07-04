import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSubjects from "./tools/list-subjects";
import listTasks from "./tools/list-tasks";
import createTask from "./tools/create-task";
import logSession from "./tools/log-session";
import studyStats from "./tools/study-stats";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "studytime-mcp",
  title: "StudyTime MCP",
  version: "0.1.0",
  instructions:
    "Tools for StudyTime: inspect and modify the signed-in user's study plan. " +
    "Use `list_subjects` to see subjects, `list_tasks` for the plan, `create_task` to add a task, " +
    "`log_study_session` to record completed focus time, and `get_study_stats` for weekly totals.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listSubjects, listTasks, createTask, logSession, studyStats],
});