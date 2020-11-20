# Serverless Artifact Cacher

## Deprecation Notice

This project is retired. It is recommended to use a service like [AWS CodeArtifact](https://docs.aws.amazon.com/codeartifact/latest/ug/welcome.html) instead.

## Old Overview

This project deploys a [Serverless](https://serverless.com/cli/) artifact caching service. It currently supports transparent caching of:

* [npm](https://www.npmjs.com/) packages for Node.js
* [pip](https://pypi.org/) packages for Python

## Setup

### Pre-reqs

* Clone the project
* Configure the allowed IPs to access the service:
    * Search for `aws:SourceIp` in serverless.js & edit/uncomment the IP restriction, turning:

```
          // "Condition": {
          //   "IpAddress": {
          //     "aws:SourceIp": ["X.X.X.X"]
          //   }
          // }
```
into something like:
```
          "Condition": {
            "IpAddress": {
              "aws:SourceIp": ["1.2.3.4"]
            }
          }
```

Serverless [variable lookup](https://serverless.com/framework/docs/providers/aws/guide/variables/) can be used here to dynamically retrieve the values, e.g. `"aws:SourceIp": ["${ssm:/path/to/stringlistparam~split}"]`
 
### Deploying

* Run `npm install`
    * If any errors arise try deleting `package-lock.json` and trying again
* Run sls deploy for your stage & region; e.g. for the "common" stage in oregon: `npx sls deploy -s common -r us-west-2`

Upon completion, you can determine your cache URLs from the displayed endpoints:

* NPM:
    * `https://SOMEID.execute-api.REGION.amazonaws.com/STAGE/npm`
* PyPi:
    * `https://SOMEID.execute-api.REGION.amazonaws.com/STAGE/pypi`

These URLs can be programatically retrieved via the CloudFormation stack (stack name `artifact-cacher-STAGE`) output `ServiceEndpoint` -- append `/npm` or `pypi` to it for their respective services.

## Use

In your execution environment (e.g. CodeBuild w/ VPC configuration), perform the following:

### NPM

Set the `NPM_CONFIG_REGISTRY` environment variable to your NPM endpoint

### PyPi (Python)

#### Pipenv (Recommended)

For [Pipenv](https://github.com/pypa/pipenv), set the `PIPENV_PYPI_MIRROR` environment variable to your PyPi endpoint.

#### Pip

For regular pip installs, run:
```
mkdir -p ~/.pip/pip.conf
echo "[global]
index-url = YOURPYPIENDPOINT" >> ~/.pip/pip.conf
```
(substituting the PyPi endpoint for YOURPYPIENDPOINT)

## Operation/Maintenance

Each repository should be self-sufficient:
* Upon request for a new (not-before-cached) package, the service will cache the list of available versions for that package.
* Upon request to download a package version, the service will first cache the download and then offer the download from the cache

Subsequent installs of a package will be served entirely from the local cache.

### Automatic Updates

Requests for a previously retrieved package are served solely from the cache, so newly uploaded package versions won't be displayed. The `AutoUpdate` functions will run daily to incorporate new package versions in into the cached version list.

The schedule can be adjusted in `serverless.js` (search for `rate(24 hours)`), and the update process can be triggered at any time by invoking the AutoUpdate functions.

### Cached PIP Versions

The DynamoDB table for each repository stores an item for each cached package. New upstream entries will be automatically added daily (see "Automatic Updates")

#### Cached NPM Versions

The NPM data is stored gzip format. It can be downloaded from s3bucket://${packageName}/index.gz.
- Download the file and from the GUI click on "Decompress" in the Convert menu.
- From the command line type `gzip -kd index.gz`

New upstream entries will be automatically added daily (see "Automatic Updates")
