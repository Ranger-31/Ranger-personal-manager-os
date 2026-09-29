import { redirect } from "next/navigation";

// アプリ起動時は必ずToday
export default function Home() {
  redirect("/today");
}
