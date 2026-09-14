import { prisma } from "@platform/db";

export interface CreateCompanyInput {
  tenantId: string;
  name: string;
  domain?: string;
  industry?: string;
  website?: string;
}

export async function createCompany(input: CreateCompanyInput) {
  return prisma.company.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      domain: input.domain,
      industry: input.industry,
      website: input.website,
    },
  });
}
