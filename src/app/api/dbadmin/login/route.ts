import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { password } = await req.json();

  // DEBUG: imprime a senha digitada e a senha do .env
  console.log("Password recebido:", password);
  console.log("Senha esperada:", process.env.DB_ADMIN_PASSWORD);

  if (password === process.env.DB_ADMIN_PASSWORD) {
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json({ success: false }, { status: 401 });
  }
}
