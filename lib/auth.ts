import prisma from './prisma'

export async function ensureUserExists(userId: string, email: string, name: string) {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!existingUser) {
    await prisma.user.create({
      data: {
        id: userId,
        email,
        name: name || 'Anonymous',
      }
    })
  }

  return existingUser || await prisma.user.findUnique({
    where: { id: userId }
  })
} 