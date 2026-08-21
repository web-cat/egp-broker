export interface ToolLaunchParamsResponse {
  url: string
  params: Record<string, string>
}

export function useToolLaunchParams() {
  return useFetch<ToolLaunchParamsResponse>('/api/lti13/get-tool-launch-params')
}
