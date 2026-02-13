import { PrismaClient, type User } from '@prisma/client'

const prisma = new PrismaClient()

// Test users with pre-hashed passwords (compatible with nuxt-auth-utils)
const seedUsers = [
  {
    email: 'admin@example.com',
    password:
      '$scrypt$n=16384,r=8,p=1$InqZJYQ714zfbFY4fs81nA$EiUh6dwE+WfBNWkdoMgFYV4b4xVworZ/loCtEFeLlYokZT1dPl2gGdcnV5/9RmJhLGzaKoxUZoT4CiqwmiBigg', // Admin123!
    firstName: 'Admin',
    lastName: 'User',
    globalRole: 'ADMIN' as const,
    emailVerified: true,
    emailVerifiedAt: new Date()
  },
  {
    email: 'demo@example.com',
    password:
      '$scrypt$n=16384,r=8,p=1$J1715Bk7oV9rbFwFCPtSpA$y61smy4tql8Il9ybDfpOikdxkkcBVm6T5bJFlL1BDnDrURseVB25keJDYwdlgVVJYIhaP5flZvdT3OMKN7YQkw', // Demo123!
    firstName: 'Demo',
    lastName: 'User',
    globalRole: 'USER' as const,
    emailVerified: true,
    emailVerifiedAt: new Date()
  }
]

async function main() {
  console.log('🌱 Starting database seeding...')

  // Clean up existing data
  await prisma.passRedemption.deleteMany()
  await prisma.studentPassPool.deleteMany()
  await prisma.passPrompt.deleteMany()
  await prisma.passEligibility.deleteMany()
  await prisma.passType.deleteMany()
  await prisma.assignment.deleteMany()
  await prisma.enrollment.deleteMany()
  await prisma.course.deleteMany()
  await prisma.ltiIdentity.deleteMany()
  await prisma.ltiDeployment.deleteMany()
  await prisma.ltiPlatform.deleteMany()
  await prisma.user.deleteMany()
  console.log('✅ Existing data deleted')

  // Create test users with pre-hashed passwords
  const createdUsers: User[] = []
  for (const userData of seedUsers) {
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        password: userData.password, // Already hashed
        firstName: userData.firstName,
        lastName: userData.lastName,
        globalRole: userData.globalRole,
        emailVerified: userData.emailVerified,
        emailVerifiedAt: userData.emailVerifiedAt
      }
    })
    createdUsers.push(user)
  }
  console.log(`✅ ${createdUsers.length} test users created`)

  // Create LTI Platform and Deployment
  const platform = await prisma.ltiPlatform.create({
    data: {
      issuer: 'https://canvas.instructure.com',
      clientId: 'broker-client-id',
      authEndpoint: 'https://canvas.instructure.com/api/lti/authorize_redirect',
      tokenEndpoint: 'https://canvas.instructure.com/login/oauth2/token',
      jwksEndpoint: 'https://canvas.instructure.com/api/lti/security/jwks',
      name: 'Canvas Main'
    }
  })

  const deployment = await prisma.ltiDeployment.create({
    data: {
      platformId: platform.id,
      deploymentId: 'deployment-1'
    }
  })
  console.log('✅ LTI platform and deployment created')

  // Create Courses
  const course1 = await prisma.course.create({
    data: {
      deploymentId: deployment.id,
      ltiContextId: 'course-101',
      label: 'CS 101',
      title: 'Introduction to Computer Science',
      workflowState: 'active'
    }
  })

  const course2 = await prisma.course.create({
    data: {
      deploymentId: deployment.id,
      ltiContextId: 'course-201',
      label: 'CS 201',
      title: 'Data Structures and Algorithms',
      workflowState: 'active'
    }
  })
  console.log('✅ 2 courses created')

  // Enrollments
  // Admin (index 0) as TEACHER in both
  // Demo (index 1) as STUDENT in both
  const admin = createdUsers[0]
  const demo = createdUsers[1]

  await prisma.enrollment.createMany({
    data: [
      { userId: admin.id, courseId: course1.id, role: 'TEACHER' },
      { userId: admin.id, courseId: course2.id, role: 'TEACHER' },
      { userId: demo.id, courseId: course1.id, role: 'STUDENT' },
      { userId: demo.id, courseId: course2.id, role: 'STUDENT' }
    ]
  })
  console.log('✅ Enrollments created (Admin as Teacher, Demo as Student)')

  // Create Pass Types
  const _passType1 = await prisma.passType.create({
    data: {
      courseId: course1.id,
      name: 'Late Day Pass',
      description: 'Exchange 1 pass for a 24-hour extension on any assignment.',
      initialBalance: 3,
      hoursPerPass: 24,
      allowRequests: true
    }
  })

  const _passType2 = await prisma.passType.create({
    data: {
      courseId: course2.id,
      name: 'Exam Resubmission',
      description: 'Allows one resubmission of a major exam.',
      initialBalance: 1,
      hoursPerPass: 0,
      allowRequests: false
    }
  })
  console.log('✅ 2 pass types created')

  // Seed Student Pass Pools
  const studentEnrollments = await prisma.enrollment.findMany({
    where: { role: 'STUDENT' },
    include: { course: { include: { passTypes: true } } }
  })

  for (const enrollment of studentEnrollments) {
    for (const passType of enrollment.course.passTypes) {
      await prisma.studentPassPool.create({
        data: {
          userId: enrollment.userId,
          passTypeId: passType.id,
          balance: passType.initialBalance
        }
      })
    }
  }
  console.log(`✅ Seeded pass pools for ${studentEnrollments.length} student enrollments`)

  // Create Assignments
  await prisma.assignment.createMany({
    data: [
      { courseId: course1.id, resourceLinkId: 'link-1', title: 'Hello World in Python' },
      { courseId: course1.id, resourceLinkId: 'link-2', title: 'Variables and Loops' },
      { courseId: course2.id, resourceLinkId: 'link-3', title: 'Implementing a Linked List' },
      { courseId: course2.id, resourceLinkId: 'link-4', title: 'Recursive Binary Search' }
    ]
  })
  console.log('✅ 4 assignments created (2 per course)')

  // Display created users for reference
  console.log('\n📋 Created users:')
  for (const user of createdUsers) {
    console.log(`   • ${user.firstName} ${user.lastName} (${user.email}) - ID: ${user.id}`)
  }

  console.log('🎉 Seeding completed successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error during seeding:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
