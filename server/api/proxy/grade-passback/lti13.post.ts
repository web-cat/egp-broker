export default defineEventHandler(async (event) => {
  console.log('--- LTI 1.3 GRADE PASSBACK REACHED ---')
  const rawBody = await readRawBody(event, 'utf-8')
  console.log(rawBody)
})
