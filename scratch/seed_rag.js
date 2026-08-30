module.paths.push('./server/node_modules');
const dotenv = require('dotenv');
dotenv.config({ path: './server/.env' });

async function seedRag() {
  console.log('=== Seeding Extended Phase 4 Legal Knowledge Base ===\n');

  process.env.NODE_ENV = 'test';
  const express = require('express');
  const connectDB = require('../server/utils/db');
  const ragRoutes = require('../server/routes/ragRoutes');
  
  try {
    await connectDB();
    console.log('Connected to MongoDB.');
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }

  const app = express();
  app.use(express.json());
  app.use('/api/rag', ragRoutes);

  const server = app.listen(5000, async () => {
    console.log('Seed server listening on port 5000.');
    
    // ==========================================
    // DOMAIN 1: Employment Agreements & Standing Orders
    // ==========================================
    const karnatakaShopsActText = `
CHAPTER I: PRELIMINARY
Section 1. Short title, extent, commencement and application
This Act may be called the Karnataka Shops and Commercial Establishments Act, 1961. It extends to the whole of the State of Karnataka.

CHAPTER II: REGISTRATION OF ESTABLISHMENTS
Section 3. Registration of establishments
Within the period specified in subsection (3), the employer of every establishment shall send to the Inspector of the area concerned a statement in the prescribed form together with such fees as may be prescribed.

CHAPTER VII: EMPLOYMENT TERMINATION
Section 39. Notice of Dismissal
No employer shall remove or dismiss an employee who has been in his continuous employment for not less than six months without giving one month notice in writing, or wages in lieu thereof, unless it is for misconduct.
    `;

    const centralWageCodeText = `
CHAPTER II: MINIMUM WAGES
Section 6. Mode of payment of wages
All wages shall be paid in current coin or currency notes or by cheque or by crediting the wages in the bank account of the employee or by the electronic mode.

Section 9. Fixation of minimum wages
The appropriate Government shall fix the minimum rate of wages for employees, taking into account the skills of workers, arduousness of work, and geographical area.
    `;

    // ==========================================
    // DOMAIN 2: Rental & Lease Agreements
    // ==========================================
    const transferOfPropertyActText = `
CHAPTER V: OF LEASES OF IMMOVEABLE PROPERTY
Section 105. Lease defined
A lease of immoveable property is a transfer of a right to enjoy such property, made for a certain time, express or implied, or in perpetuity, in consideration of a price paid or promised.

Section 106. Duration of certain leases in absence of written contract
In the absence of a contract or local law or usage to the contrary, a lease of immovable property for agricultural or manufacturing purposes shall be deemed to be a lease from year to year, terminable, on the part of either lessor or lessee, by six months notice.

Section 108. Rights and liabilities of lessor and lessee
In the absence of a contract or local usage to the contrary, the lessor is bound to disclose to the lessee any material defect in the property, and the lessee is bound to pay the rent at the proper time and place.
    `;

    const karnatakaRentActText = `
CHAPTER V: CONTROL OF EVICTION OF TENANTS
Section 27. Protection of tenants against eviction
Notwithstanding anything to the contrary contained in any other law or contract, no order or decree for the recovery of possession of any premises shall be made by any court, Landlord or Tribunal in favour of the landlord against a tenant, except on specific grounds like non-payment of rent, subletting without consent, or bona fide personal requirement.
    `;

    // ==========================================
    // DOMAIN 3: Non-Disclosure Agreements (NDAs)
    // ==========================================
    const contractActNdaText = `
CHAPTER II: OF CONTRACTS
Section 27. Agreement in restraint of trade void
Every agreement by which any one is restrained from exercising a lawful profession, trade or business of any kind, is to that extent void. Exceptions include agreement not to carry on business of which goodwill is sold.
    `;

    const specificReliefActText = `
CHAPTER VII: INJUNCTIONS GENERALLY
Section 37. Temporary and perpetual injunctions
Temporary injunctions are such as are to continue until a specified time, or until the further order of the court, and they may be granted at any stage of a suit.

Section 38. Perpetual injunction when granted
Subject to the other provisions contained in this Chapter, a perpetual injunction may be granted to the plaintiff to prevent the breach of an obligation existing in his favour, whether expressly or by implication.
    `;

    // ==========================================
    // DOMAIN 4: Service / Vendor Agreements
    // ==========================================
    const saleOfGoodsActText = `
CHAPTER II: CONDITIONS AND WARRANTIES
Section 12. Condition and warranty
A condition is a stipulation essential to the main purpose of the contract, the breach of which gives rise to a right to treat the contract as repudiated. A warranty is a stipulation collateral to the main purpose, the breach of which gives rise to a claim for damages but not to a right to reject the goods.

CHAPTER III: TRANSFER OF PROPERTY AS BETWEEN SELLER AND BUYER
Section 19. Property passes when intended to pass
Where there is a contract for the sale of specific or ascertained goods the property in them is transferred to the buyer at such time as the parties to the contract intend it to be transferred.
    `;

    // ==========================================
    // DOMAIN 5: Employment Statutory Benefits
    // ==========================================
    const epfActText = `
CHAPTER I: PRELIMINARY
Section 6. Contributions and matters which may be provided for in Schemes
The contribution which shall be paid by the employer to the Fund shall be ten per cent or twelve per cent of the basic wages, dearness allowance and retaining allowance for the time being payable to each of the employees.
    `;

    const gratuityActText = `
CHAPTER I: PRELIMINARY
Section 4. Payment of gratuity
Gratuity shall be payable to an employee on the termination of his employment after he has rendered continuous service for not less than five years: (a) on his superannuation, or (b) on his retirement or resignation, or (c) on his death or disablement due to accident or disease.
    `;

    try {
      console.log('--- Seeding Domain 1: Employment Agreements ---');
      await ingestToRAG('state_laws', karnatakaShopsActText, 'Karnataka Shops Act 1961', 'Karnataka', 'Employment');
      await ingestToRAG('statutes', centralWageCodeText, 'Code on Wages 2019', null, 'Employment');

      console.log('\n--- Seeding Domain 2: Rental & Lease Agreements ---');
      await ingestToRAG('statutes', transferOfPropertyActText, 'Transfer of Property Act 1882', null, 'Rental');
      await ingestToRAG('state_laws', karnatakaRentActText, 'Karnataka Rent Control Act 2001', 'Karnataka', 'Rental');

      console.log('\n--- Seeding Domain 3: Non-Disclosure Agreements (NDAs) ---');
      await ingestToRAG('statutes', contractActNdaText, 'Indian Contract Act 1872 (NDA)', null, 'NDA');
      await ingestToRAG('statutes', specificReliefActText, 'Specific Relief Act 1963', null, 'NDA');

      console.log('\n--- Seeding Domain 4: Service / Vendor Agreements ---');
      await ingestToRAG('statutes', saleOfGoodsActText, 'Sale of Goods Act 1930', null, 'Vendor');

      console.log('\n--- Seeding Domain 5: Employment Statutory Benefits ---');
      await ingestToRAG('statutes', epfActText, 'Employees Provident Funds Act 1952', null, 'Benefits');
      await ingestToRAG('statutes', gratuityActText, 'Payment of Gratuity Act 1972', null, 'Benefits');

      console.log('\n=== Seeding of All 5 Domains Completed Successfully ===');
    } catch (err) {
      console.error('Seeding failed:', err);
    } finally {
      server.close(() => {
        console.log('Seed server shut down.');
        process.exit(0);
      });
    }
  });
}

async function ingestToRAG(collection, text, actName, state, domain) {
  console.log(`Ingesting ${actName} into ${collection} collection...`);
  const res = await fetch('http://localhost:5000/api/rag/seed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token-uid-123'
    },
    body: JSON.stringify({
      targetCollection: collection,
      text: text,
      metadataDefaults: {
        act: actName,
        country: 'India',
        state: state,
        domain: domain
      }
    })
  });
  
  const data = await res.json();
  if (res.ok) {
    console.log(`- Success: Ingested ${data.chunk_count} chunks.`);
  } else {
    console.error(`- Failed: ${JSON.stringify(data)}`);
  }
}

seedRag();
