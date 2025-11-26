// apps/web/src/inngest/index.ts
export { inngest } from "./client"
import { helloWorld } from "./functions/hello-world"
import { sitePublish } from "./functions/site-publish"
import { siteRevert } from "./functions/site-revert"
import { domainConnect } from "./functions/domain-connect"
import { domainVerify } from "./functions/domain-verify"
import { domainRemove } from "./functions/domain-remove"
import { siteGithubConfigSync } from "./functions/github-config-sync"

export const functions = [
  helloWorld,
  sitePublish,
  siteRevert,
  domainConnect,
  domainVerify,
  domainRemove,
  siteGithubConfigSync,
]
