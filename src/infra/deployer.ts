export function createDeployer() {
  const deployer = new sst.aws.CodeBuild('Deployer', {
    buildspec: 'buildspec.yml',
    environment: {
      computeType: 'BUILD_GENERAL1_SMALL',
    },
  });

  return { deployer };
}
