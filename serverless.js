async function getConfig() {
  const generalConfig = {
    "service": "artifact-cacher",
    "plugins": [
      "serverless-webpack",
      "serverless-iam-roles-per-function"
    ],
    "provider": {
      "name": "aws",
      "runtime": "nodejs10.x",
      "resourcePolicy": [
        {
          "Effect": "Allow",
          "Principal": "*",
          "Action": "execute-api:Invoke",
          "Resource": [
            "execute-api:/*/*/*"
          ],
          // "Condition": {
          //   "IpAddress": {
          //     "aws:SourceIp": ["X.X.X.X"]
          //   }
          // }
        }
      ]
    },
    // Packaging each function individually cuts down their size significantly,
    // but can cause memory issues
    // https://github.com/serverless-heaven/serverless-webpack/issues/299
    // To safely enable this, it's advised to:
    // 1) Run 'export NODE_OPTIONS=--max_old_space_size=8192' or (windows) '$Env:NODE_OPTIONS = "--max_old_space_size=8192"', and
    // 2) Apply the patch from https://github.com/serverless-heaven/serverless-webpack/pull/517 to serverless-webpack
    //    (just update the lib/Configuration.js, lib/compile.js, & lib/validate.js files)
    // "package": {
    //   "individually": true
    // },
    "custom": {
      "webpack": {
        "excludeFiles": [
          "src/**/*.test.ts",
          "src/**/__mocks__/*.ts"
        ]
        // We could exclude aws-sdk here to trim down the deployment package via
        // webpack-node-externals (see webpack.config.js), but instead we'll
        // include it so the sdk version used is predictable.
        // "includeModules": {
        //   "forceExclude": [
        //     "aws-sdk"
        //   ]
        // }
      }
    }
  };

  const npmResources = {};
  const npmStorageBucketResourceName = "NpmStorageBucket";
  npmResources[npmStorageBucketResourceName] = {
    "Type": "AWS::S3::Bucket",
    "DeletionPolicy": "Retain"
  }
  const npmTableResourceName = "NpmTable";
  npmResources[npmTableResourceName] = {
    "Type": "AWS::DynamoDB::Table",
    "Properties": {
      "AttributeDefinitions": [
        {
          "AttributeName": "PackageName",
          "AttributeType": "S"
        }
      ],
      "KeySchema": [
        {
          "AttributeName": "PackageName",
          "KeyType": "HASH"
        }
      ],
      "BillingMode": "PAY_PER_REQUEST"
    }
  };

  const npmFunctions = {
    "npmHyphen": {
      "handler": "src/npm/hyphen/hyphen.handler",
      "events": [
        {
          "http": {
            "path": "npm/-/{proxy+}",
            "method": "get",
            "integration": "lambda-proxy"
          }
        }
      ]
    },

    "npmPackage": {
      "handler": "src/npm/package/package.handler",
      "environment": {
        "DDB_TABLE": {
          "Ref": npmTableResourceName
        }
      },
      "iamRoleStatements": [
        {
          "Action": [
            "dynamodb:GetItem",
            "dynamodb:PutItem"
          ],
          "Effect": "Allow",
          "Resource": {
            "Fn::GetAtt": [
              npmTableResourceName,
              "Arn"
            ]
          }
        }
      ],
      "events": [
        {
          "http": {
            "path": "npm/{proxy+}",
            "method": "get",
            "integration": "lambda-proxy"
          }
        }
      ]
    },

    "npmAutoUpdate": {
      "handler": "src/npm/autoupdate/autoupdate.handler",
      "timeout": 900,
      "environment": {
        "DDB_TABLE": {
          "Ref": npmTableResourceName
        },
        "NPM_CACHE_DOWNLOAD_URI": {
          "Fn::Join": [
            "",
            ["https://",
             {"Ref": "ApiGatewayRestApi"},
             ".execute-api.",
             {"Ref": "AWS::Region"},
             ".",
             {"Ref": "AWS::URLSuffix"},
             "/${opt:stage}/npm-dlredirect"]
          ]
        }
      },
      "iamRoleStatements": [
        {
          "Action": [
            "dynamodb:PutItem",
            "dynamodb:Scan"
          ],
          "Effect": "Allow",
          "Resource": {
            "Fn::GetAtt": [
              npmTableResourceName,
              "Arn"
            ]
          }
        }
      ],
      "events": [
        {
          "schedule": "rate(24 hours)"
        }
      ]
    },

    "npmDlRedirect": {
      "handler": "src/npm/dlredirect/dlredirect.handler",
      "timeout": 30,
      "environment": {
        "BUCKET_NAME": {
          "Ref": npmStorageBucketResourceName
        }
      },
      "iamRoleStatements": [
        {
          "Action": [
            "s3:ListBucket"
          ],
          "Effect": "Allow",
          "Resource": {
            "Fn::GetAtt": [
              npmStorageBucketResourceName,
              "Arn"
            ]
          }
        },
        {
          "Action": [
            "s3:GetObject",
            "s3:PutObject"
          ],
          "Effect": "Allow",
          "Resource": {
            "Fn::Join": [
              "",
              [
                {
                  "Fn::GetAtt": [
                    npmStorageBucketResourceName,
                    "Arn"
                  ]
                },
                "/*"
              ]
            ]
          }
        }
      ],
      "events": [
        {
          "http": {
            "path": "npm-dlredirect/{proxy+}",
            "method": "get",
            "integration": "lambda-proxy"
          }
        }
      ]
    }
  };

  const pypiResources = {};
  const pypiStorageBucketResourceName = "PyPiStorageBucket";
  pypiResources[pypiStorageBucketResourceName] = {
    "Type": "AWS::S3::Bucket",
    "DeletionPolicy": "Retain"
  }
  const pypiTableResourceName = "PyPiTable";
  pypiResources[pypiTableResourceName] = {
    "Type": "AWS::DynamoDB::Table",
    "Properties": {
      "AttributeDefinitions": [
        {
          "AttributeName": "PackageName",
          "AttributeType": "S"
        }
      ],
      "KeySchema": [
        {
          "AttributeName": "PackageName",
          "KeyType": "HASH"
        }
      ],
      "BillingMode": "PAY_PER_REQUEST"
    }
  };

  const pypiFunctions = {
    "pypiList": {
      "handler": "src/pypi/list/list.handler",
      "environment": {
        "DDB_TABLE": {
          "Ref": pypiTableResourceName
        }
      },
      "iamRoleStatements": [
        {
          "Action": [
            "dynamodb:Scan"
          ],
          "Effect": "Allow",
          "Resource": {
            "Fn::GetAtt": [
              pypiTableResourceName,
              "Arn"
            ]
          }
        }
      ],
      "events": [
        {
          "http": {
            "path": "pypi/",
            "method": "get",
            "integration": "lambda-proxy"
          }
        }
      ]
    },

    "pypiPackage": {
      "handler": "src/pypi/package/package.handler",
      "environment": {
        "DDB_TABLE": {
          "Ref": pypiTableResourceName
        }
      },
      "iamRoleStatements": [
        {
          "Action": [
            "dynamodb:GetItem",
            "dynamodb:PutItem"
          ],
          "Effect": "Allow",
          "Resource": {
            "Fn::GetAtt": [
              pypiTableResourceName,
              "Arn"
            ]
          }
        }
      ],
      "events": [
        {
          "http": {
            "path": "pypi/{proxy+}",
            "method": "get",
            "integration": "lambda-proxy"
          }
        }
      ]
    },

    "pypiAutoUpdate": {
      "handler": "src/pypi/autoupdate/autoupdate.handler",
      "timeout": 900,
      "environment": {
        "DDB_TABLE": {
          "Ref": pypiTableResourceName
        }
      },
      "iamRoleStatements": [
        {
          "Action": [
            "dynamodb:PutItem",
            "dynamodb:Scan"
          ],
          "Effect": "Allow",
          "Resource": {
            "Fn::GetAtt": [
              pypiTableResourceName,
              "Arn"
            ]
          }
        }
      ],
      "events": [
        {
          "schedule": "rate(24 hours)"
        }
      ]
    },

    "pypiDlRedirect": {
      "handler": "src/pypi/dlredirect/dlredirect.handler",
      "timeout": 30,
      "environment": {
        "BUCKET_NAME": {
          "Ref": pypiStorageBucketResourceName
        }
      },
      "iamRoleStatements": [
        {
          "Action": [
            "s3:ListBucket"
          ],
          "Effect": "Allow",
          "Resource": {
            "Fn::GetAtt": [
              pypiStorageBucketResourceName,
              "Arn"
            ]
          }
        },
        {
          "Action": [
            "s3:GetObject",
            "s3:PutObject"
          ],
          "Effect": "Allow",
          "Resource": {
            "Fn::Join": [
              "",
              [
                {
                  "Fn::GetAtt": [
                    pypiStorageBucketResourceName,
                    "Arn"
                  ]
                },
                "/*"
              ]
            ]
          }
        }
      ],
      "events": [
        {
          "http": {
            "path": "pypi-dlredirect/{proxy+}",
            "method": "get",
            "integration": "lambda-proxy"
          }
        }
      ]
    }
  };

  return {
    ...generalConfig,
    "functions": {
      ...npmFunctions,
      ...pypiFunctions
    },
    "resources": {
      "Resources": {
        ...npmResources,
        ...pypiResources
      }
    }
  };
}

module.exports = getConfig();
