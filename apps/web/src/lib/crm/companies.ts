import { prisma } from "@platform/db";

export interface CreateCompanyInput {
  name: string;
  domain?: string;
  industry?: string;
  website?: string;
}

export async function createCompany(input: CreateCompanyInput) {
  return prisma.company.create({
    data: {
      name: input.name,
      domain: input.domain,
      industry: input.industry,
      website: input.website,
    },
  });
}
