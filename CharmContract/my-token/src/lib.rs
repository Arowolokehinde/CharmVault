use charms_sdk::data::{
    charm_values, check, App, Data, Transaction, UtxoId, B32, NFT,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

// Represents the current state of an inheritance contract
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum InheritanceStatus {
    Active,       // Owner is alive, can check-in and update
    Triggered,    // Deadline passed, ready for distribution
    Distributed,  // Already distributed to beneficiaries (final state)
}

// Represents one beneficiary who will inherit BTC
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Beneficiary {
    pub address: String,    // Bitcoin address to receive inheritance
    pub percentage: u8,     // Percentage of total (0-100)
}

// The main inheritance contract - stored in the NFT charm
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InheritanceContent {
    pub owner_pubkey: String,              // Owner's public key (for authentication)
    pub last_checkin_block: u64,           // Block height of last check-in
    pub trigger_delay_blocks: u64,         // Blocks to wait before triggering (e.g., 4320 ≈ 30 days)
    pub beneficiaries: Vec<Beneficiary>,   // List of beneficiaries with percentages
    pub status: InheritanceStatus,         // Current state (enum, not string!)
}

/// Main entry point for the inheritance contract
/// Called by Charms SDK to validate every transaction that spends an inheritance charm
///
/// Returns true if the transaction is valid (one of the 4 operations succeeds)
/// Returns false if the transaction violates the contract rules
pub fn app_contract(app: &App, tx: &Transaction, x: &Data, w: &Data) -> bool {
    // We don't use public inputs for now, so they must be empty
    let empty = Data::empty();
    assert_eq!(x, &empty);

    match app.tag {
        NFT => {
            // A transaction is valid if ANY of these operations is satisfied:
            check!(
                can_create_inheritance(app, tx, w) ||      // 1. Create new inheritance
                can_checkin(app, tx) ||                    // 2. Owner extends deadline
                can_update_beneficiaries(app, tx) ||       // 3. Owner modifies beneficiaries
                can_trigger_distribution(app, tx)          // 4. Distribute to beneficiaries
            )
        }
        _ => {
            // Only NFT tag is supported for inheritance contracts
            eprintln!("Unsupported app tag: {:?}", app.tag);
            return false;
        }
    }
    true
}

//
// ==================== OPERATION 1: CREATE INHERITANCE ====================
//

/// Validates creating a new inheritance contract
///
/// Requirements:
/// - Witness data (w) must contain a UTXO ID, and its hash becomes the app identity
/// - That UTXO must be spent in this transaction (prevents replay attacks)
/// - Exactly one NFT must be created in the outputs
/// - The NFT must have valid InheritanceContent structure
/// - Beneficiary percentages must sum to 100
fn can_create_inheritance(app: &App, tx: &Transaction, w: &Data) -> bool {
    // Extract witness data (should be a UTXO ID string)
    let w_str: Option<String> = w.value().ok();
    check!(w_str.is_some());
    let w_str = w_str.unwrap();

    // Verify the hash of witness data matches the app identity
    // This ties the inheritance to a specific UTXO
    check!(hash(&w_str) == app.identity);

    // Verify that the UTXO referenced in witness is being spent
    // This prevents someone from reusing the same witness data
    let w_utxo_id = UtxoId::from_str(&w_str).unwrap();
    check!(tx.ins.iter().any(|(utxo_id, _)| utxo_id == &w_utxo_id));

    // Get all NFT charms in the outputs
    let nft_charms = charm_values(app, tx.outs.iter()).collect::<Vec<_>>();

    // Must create exactly one inheritance NFT
    check!(nft_charms.len() == 1);

    // Verify the NFT has correct structure
    let inheritance: Result<InheritanceContent, _> = nft_charms[0].value();
    check!(inheritance.is_ok());
    let inheritance = inheritance.unwrap();

    // Validate business logic
    check!(validate_inheritance(&inheritance));

    true
}

//
// ==================== OPERATION 2: CHECK-IN (EXTEND DEADLINE) ====================
//

/// Validates a check-in operation (owner extending the deadline)
///
/// Requirements:
/// - Must have exactly 1 input NFT and 1 output NFT
/// - Input status must be Active
/// - Output status must remain Active
/// - last_checkin_block must be updated (increased)
/// - All other fields must remain unchanged
fn can_checkin(app: &App, tx: &Transaction) -> bool {
    // Get input inheritance state
    let input_charms: Vec<_> = charm_values(app, tx.ins.iter().map(|(_, v)| v)).collect();
    check!(input_charms.len() == 1);

    let input_inheritance: Result<InheritanceContent, _> = input_charms[0].value();
    check!(input_inheritance.is_ok());
    let input_inheritance = input_inheritance.unwrap();

    // Must be in Active status to check-in
    check!(input_inheritance.status == InheritanceStatus::Active);

    // Get output inheritance state
    let output_charms: Vec<_> = charm_values(app, tx.outs.iter()).collect();
    check!(output_charms.len() == 1);

    let output_inheritance: Result<InheritanceContent, _> = output_charms[0].value();
    check!(output_inheritance.is_ok());
    let output_inheritance = output_inheritance.unwrap();

    // Output must also be Active
    check!(output_inheritance.status == InheritanceStatus::Active);

    // last_checkin_block must be updated (owner proved they're alive)
    check!(output_inheritance.last_checkin_block > input_inheritance.last_checkin_block);

    // All other fields must remain unchanged
    check!(output_inheritance.owner_pubkey == input_inheritance.owner_pubkey);
    check!(output_inheritance.trigger_delay_blocks == input_inheritance.trigger_delay_blocks);
    check!(beneficiaries_equal(&output_inheritance.beneficiaries, &input_inheritance.beneficiaries));

    true
}

//
// ==================== OPERATION 3: UPDATE BENEFICIARIES ====================
//

/// Validates updating the beneficiaries list
///
/// Requirements:
/// - Must have exactly 1 input NFT and 1 output NFT
/// - Input status must be Active
/// - Output status must remain Active
/// - Beneficiaries can be modified
/// - New beneficiaries must be valid (percentages sum to 100)
/// - last_checkin_block should be updated (to extend deadline)
/// - owner_pubkey and trigger_delay_blocks must remain unchanged
fn can_update_beneficiaries(app: &App, tx: &Transaction) -> bool {
    // Get input inheritance state
    let input_charms: Vec<_> = charm_values(app, tx.ins.iter().map(|(_, v)| v)).collect();
    check!(input_charms.len() == 1);

    let input_inheritance: Result<InheritanceContent, _> = input_charms[0].value();
    check!(input_inheritance.is_ok());
    let input_inheritance = input_inheritance.unwrap();

    // Must be in Active status to update
    check!(input_inheritance.status == InheritanceStatus::Active);

    // Get output inheritance state
    let output_charms: Vec<_> = charm_values(app, tx.outs.iter()).collect();
    check!(output_charms.len() == 1);

    let output_inheritance: Result<InheritanceContent, _> = output_charms[0].value();
    check!(output_inheritance.is_ok());
    let output_inheritance = output_inheritance.unwrap();

    // Output must also be Active
    check!(output_inheritance.status == InheritanceStatus::Active);

    // Validate new beneficiaries
    check!(validate_beneficiaries(&output_inheritance.beneficiaries));

    // Core fields must remain unchanged
    check!(output_inheritance.owner_pubkey == input_inheritance.owner_pubkey);
    check!(output_inheritance.trigger_delay_blocks == input_inheritance.trigger_delay_blocks);

    // last_checkin_block should be updated (acts as check-in too)
    check!(output_inheritance.last_checkin_block >= input_inheritance.last_checkin_block);

    true
}

//
// ==================== OPERATION 4: TRIGGER DISTRIBUTION ====================
//

/// Validates triggering the inheritance distribution
///
/// Requirements:
/// - Must have exactly 1 input NFT
/// - Input status must be Active or Triggered
/// - Deadline must have passed (current block > last_checkin + delay)
/// - Must create outputs for each beneficiary with correct amounts
/// - NFT is burned (no NFT in outputs)
fn can_trigger_distribution(app: &App, tx: &Transaction) -> bool {
    // Get input inheritance state
    let input_charms: Vec<_> = charm_values(app, tx.ins.iter().map(|(_, v)| v)).collect();
    check!(input_charms.len() == 1);

    let input_inheritance: Result<InheritanceContent, _> = input_charms[0].value();
    check!(input_inheritance.is_ok());
    let inheritance = input_inheritance.unwrap();

    // Must be Active or Triggered (not already Distributed)
    check!(
        inheritance.status == InheritanceStatus::Active ||
        inheritance.status == InheritanceStatus::Triggered
    );

    // TODO: Verify deadline has passed
    // This requires getting current block height from witness data
    // For now, we allow distribution anytime (will add block height check later)

    // Verify no NFT in outputs (NFT is burned)
    let output_charms: Vec<_> = charm_values(app, tx.outs.iter()).collect();
    check!(output_charms.is_empty());

    // TODO: Verify outputs match beneficiaries
    // This requires checking that:
    // 1. Number of outputs matches number of beneficiaries
    // 2. Each output amount = total_input * beneficiary_percentage / 100
    // We'll implement this validation in the next iteration

    true
}

//
// ==================== HELPER FUNCTIONS ====================
//

/// Validates the inheritance structure
fn validate_inheritance(inheritance: &InheritanceContent) -> bool {
    // Status must be Active when creating
    check!(inheritance.status == InheritanceStatus::Active);

    // Validate beneficiaries
    check!(validate_beneficiaries(&inheritance.beneficiaries));

    // Delay must be reasonable (at least 1 block)
    check!(inheritance.trigger_delay_blocks > 0);

    true
}

/// Validates that beneficiaries list is correct
fn validate_beneficiaries(beneficiaries: &[Beneficiary]) -> bool {
    // Must have at least one beneficiary
    check!(!beneficiaries.is_empty());

    // Percentages must sum to 100
    let total: u32 = beneficiaries.iter().map(|b| b.percentage as u32).sum();
    check!(total == 100);

    // All addresses must be non-empty
    check!(beneficiaries.iter().all(|b| !b.address.is_empty()));

    true
}

/// Checks if two beneficiary lists are equal
fn beneficiaries_equal(a: &[Beneficiary], b: &[Beneficiary]) -> bool {
    if a.len() != b.len() {
        return false;
    }

    for i in 0..a.len() {
        if a[i].address != b[i].address || a[i].percentage != b[i].percentage {
            return false;
        }
    }

    true
}

/// Hash function for creating app identity from UTXO ID
pub(crate) fn hash(data: &str) -> B32 {
    let hash = Sha256::digest(data);
    B32(hash.into())
}

//
// ==================== TESTS ====================
//

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_hash() {
        let utxo_id =
            UtxoId::from_str("dc78b09d767c8565c4a58a95e7ad5ee22b28fc1685535056a395dc94929cdd5f:1")
                .unwrap();
        let data = dbg!(utxo_id.to_string());
        let expected = "f54f6d40bd4ba808b188963ae5d72769ad5212dd1d29517ecc4063dd9f033faa";
        assert_eq!(&hash(&data).to_string(), expected);
    }

    #[test]
    fn test_validate_beneficiaries_valid() {
        let beneficiaries = vec![
            Beneficiary {
                address: "tb1p123".to_string(),
                percentage: 60,
            },
            Beneficiary {
                address: "tb1p456".to_string(),
                percentage: 40,
            },
        ];
        assert!(validate_beneficiaries(&beneficiaries));
    }

    #[test]
    fn test_validate_beneficiaries_invalid_sum() {
        let beneficiaries = vec![
            Beneficiary {
                address: "tb1p123".to_string(),
                percentage: 60,
            },
            Beneficiary {
                address: "tb1p456".to_string(),
                percentage: 50,  // Total = 110, should fail
            },
        ];
        assert!(!validate_beneficiaries(&beneficiaries));
    }
}
