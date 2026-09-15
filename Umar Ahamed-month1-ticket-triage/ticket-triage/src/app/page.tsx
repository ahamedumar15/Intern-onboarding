import { redirect } from "next/navigation";

/** The board is the product. There is no other landing page in Month 1. */
export default function HomePage(): never {
  redirect("/tickets");
}
