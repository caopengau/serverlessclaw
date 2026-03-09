export function createDeployer() {
  const deployerRole = new aws.iam.Role('DeployerRole', {
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: { Service: 'codebuild.amazonaws.com' },
        },
      ],
    }),
  });

  new aws.iam.RolePolicyAttachment('DeployerAdminPolicy', {
    policyArn: 'arn:aws:iam::aws:policy/AdministratorAccess',
    role: deployerRole.name,
  });

  const deployer = new aws.codebuild.Project('Deployer', {
    name: `${$app.name}-${$app.stage}-Deployer`,
    serviceRole: deployerRole.arn,
    artifacts: { type: 'NO_ARTIFACTS' },
    environment: {
      computeType: 'BUILD_GENERAL1_SMALL',
      image: 'aws/codebuild/amazonlinux2-x86_64-standard:5.0',
      type: 'LINUX_CONTAINER',
      environmentVariables: [{ name: 'SST_STAGE', value: $app.stage }],
    },
    source: {
      type: 'GITHUB',
      location: 'https://github.com/caopengau/serverlessclaw.git',
      buildspec: 'buildspec.yml',
    },
  });

  return { deployer };
}
