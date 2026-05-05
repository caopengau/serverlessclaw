export function roleBadge(role: string) {
  switch (role) {
    case 'owner':
      return 'primary';
    case 'admin':
      return 'intel';
    case 'collaborator':
      return 'audit';
    case 'observer':
      return 'outline';
    default:
      return 'outline';
  }
}
