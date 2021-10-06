import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as eks from '@aws-cdk/aws-eks'
import * as kms from '@aws-cdk/aws-kms'

export class AgonesCdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const clusterName = "agones-test-cluster"
    // Vpc.DEFAULT_CIDR_RANGE = '10.0.0.0/16';
    const vpc = new ec2.Vpc(this, 'EcsRailsSampleVPC', {
      subnetConfiguration: [
         {
           cidrMask: 24,
           name: 'public1',
           subnetType: ec2.SubnetType.PUBLIC,
         },
         {
          cidrMask: 24,
          name: 'public2',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'public3',
          subnetType: ec2.SubnetType.PUBLIC,
        }
      ]
    })
    cdk.Tags.of(vpc).add(`kubernetes.io/cluster/${clusterName}`, "shared")
    for (const subnet of vpc.publicSubnets) {
      cdk.Tags.of(subnet).add(`kubernetes.io/cluster/${clusterName}`, "shared")
      cdk.Tags.of(subnet).add("kubernetes.io/role/elb", "1")
    }
    const secretsKey = new kms.Key(this, 'AgonesSecretsKey', {
      removalPolicy: cdk.RemovalPolicy.DESTROY // テスト用なので消す
    })
    const cluster = new eks.Cluster(this, 'AgonesEKS', {
      version: eks.KubernetesVersion.V1_20,
      clusterName,
      vpc,
      vpcSubnets: [{ subnetType: ec2.SubnetType.PUBLIC }],
      defaultCapacity: 0,
      secretsEncryptionKey: secretsKey,
    })
    cluster.addNodegroupCapacity
    const asg = cluster.addAutoScalingGroupCapacity('defult', {
      autoScalingGroupName: "default",
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType('t3.large'),
      minCapacity: 4,
      maxCapacity: 4,
      desiredCapacity: 4,
    })
    asg.connections.allowFrom(ec2.Peer.ipv4('0.0.0.0/0'), ec2.Port.udpRange(7000, 8000))

    cluster.addAutoScalingGroupCapacity('agones-system', {
      autoScalingGroupName: "agones-system",
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType('t3.large'),
      desiredCapacity: 1,
      bootstrapOptions: {
        kubeletExtraArgs: "--node-labels=agones.dev/agones-system=true --register-with-taints=agones.dev/agones-system=true:NoExecute"
      }
    })

    cluster.addAutoScalingGroupCapacity('agones-metrics', {
      autoScalingGroupName: "agones-metrics",
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType('t3.large'),
      desiredCapacity: 1,
      bootstrapOptions: {
        kubeletExtraArgs: "--node-labels=agones.dev/agones-metrics=true --register-with-taints=agones.dev/agones-metrics=true:NoExecute"
      }
    })

  }
}
