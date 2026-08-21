import jwt from 'jsonwebtoken';

const EXPIRACAO = '7d';

interface PayloadToken {
  usuarioId: number;
}

export function gerarToken(usuarioId: number): string {
  return jwt.sign({ usuarioId }, process.env.JWT_SECRET as string, { expiresIn: EXPIRACAO });
}

export function verificarToken(token: string): PayloadToken {
  return jwt.verify(token, process.env.JWT_SECRET as string) as PayloadToken;
}
