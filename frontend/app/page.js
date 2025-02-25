import WelcomeBanner from "@/components/welcomeBanner";

export default function Home() {
  return (
    <div className="container mx-auto p-6">
      <WelcomeBanner />
    </div>
  );
}



// token: {
//   iss: 'https://canvas.endeavour.cs.vt.edu',
//   user: '3b2e8928-ef1a-4461-bdfa-3169853852f6',
//   userInfo: {
//     given_name: 'Saketh',
//     family_name: 'Rajesh',
//     name: 'Saketh Rajesh',
//     email: 'saketh@vt.edu'
//   },
//   platformInfo: {
//     guid: 'Jd7zFxl62GWQtHmq6ANZjDMyMTitMsh4jsNVACqj:canvas-lms',
//     name: 'VT',
//     version: 'cloud',
//     product_family_code: 'canvas',
//     validation_context: null
//   },
//   clientId: '10000000000006',
//   platformId: '3793f468a53b3f33c2cc9becc442e5b0',
//   deploymentId: '22:c9d7d100bb177c0e54f578e7ac538cd9f7a3e4ad',
//   createdAt: '2025-02-19T19:57:07.523Z',
//   platformContext: {
//     contextId: 'https%3A%2F%2Fcanvas.endeavour.cs.vt.edu1000000000000622%3Ac9d7d100bb177c0e54f578e7ac538cd9f7a3e4adc9d7d100bb177c0e54f578e7ac538cd9f7a3e4ad_c9d7d100bb177c0e54f578e7ac538cd9f7a3e4ad',
//     user: '3b2e8928-ef1a-4461-bdfa-3169853852f6',
//     roles: [
//       'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator',
//       'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Instructor',
//       'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
//       'http://purl.imsglobal.org/vocab/lis/v2/system/person#User'
//     ],
//     path: '/',
//     targetLinkUri: 'https://one-sunbeam-distinctly.ngrok-free.app',
//     context: {
//       id: 'c9d7d100bb177c0e54f578e7ac538cd9f7a3e4ad',
//       label: 'CS 4000',
//       title: 'CS 4000 LTI1.3',
//       type: [Array],
//       validation_context: null
//     },
//     resource: {
//       id: 'c9d7d100bb177c0e54f578e7ac538cd9f7a3e4ad',
//       description: null,
//       title: 'CS 4000 LTI1.3',
//       validation_context: null
//     },
//     launchPresentation: {
//       document_target: 'iframe',
//       return_url: 'https://canvas.endeavour.cs.vt.edu/courses/4/external_content/success/external_tool_redirect',
//       locale: 'en',
//       height: 400,
//       width: 800,
//       validation_context: null
//     },
//     messageType: 'LtiResourceLinkRequest',
//     version: '1.3.0',
//     lis: {
//       person_sourcedid: 'saketh3@vt.edu',
//       course_offering_sourcedid: null,
//       validation_context: null
//     },
//     endpoint: {
//       scope: [Array],
//       lineitems: 'https://canvas.endeavour.cs.vt.edu/api/lti/courses/4/line_items',
//       validation_context: null
//     },
//     namesRoles: {
//       context_memberships_url: 'https://canvas.endeavour.cs.vt.edu/api/lti/courses/4/names_and_roles',
//       service_versions: [Array],
//       validation_context: null
//     },
//     createdAt: '2025-02-19T19:57:07.532Z'
//   }
// }