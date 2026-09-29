import { Suspense } from "react";
import { TasksView } from "@/components/tasks/tasks-view";

export default function TasksPage() {
  return (
    <Suspense>
      <TasksView />
    </Suspense>
  );
}
