export function viewportLabel(projectName: string): 'desktop' | 'mobile' {
  return projectName.includes('mobile') ? 'mobile' : 'desktop'
}
