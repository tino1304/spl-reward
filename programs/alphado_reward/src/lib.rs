use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("2iqzG1DNfHqiGCru892VMKxhFnoiwDxQVRNtL4P3djt2");

#[program]
pub mod alphado_reward {
    use super::*;

    const TOKEN_MINT: Pubkey = pubkey!("5oQrnYuTJQw68rpghJYd8CRYaDu8tHRor413td81Dn1h");
    const OWNER: Pubkey = pubkey!("3ov7mX1aTxNLcL9CrLoFmgFmZPKThRr2LovZ5uWZCcuJ");

    pub fn initialize(ctx: Context<Initialize>, bump: u8) -> Result<()> {
        require_eq!(ctx.accounts.mint.key(), TOKEN_MINT.key());
        require_eq!(ctx.accounts.owner.key(), OWNER.key());
        Ok(())
    }

    pub fn claim_reward_with_permission(
        ctx: Context<ClaimRewardWithPermission>,
        amount: u64,
        bump: u8,
    ) -> Result<()> {
        require_eq!(ctx.accounts.owner.key(), OWNER.key());
        require_eq!(ctx.accounts.vault.mint.key(), TOKEN_MINT.key());

        // Derive the PDA and sign the CPI transfer using the PDA
        let vault_seeds: &[&[u8]] = &[b"vault".as_ref(), &[bump]];
        let signer_seeds = &[vault_seeds];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(), // Vault itself is the authority
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        token::transfer(cpi_ctx, amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct Initialize<'info> {
    // Vault token account controlled by the program (PDA)
    #[account(
        init,
        seeds = [b"vault".as_ref()],
        bump,
        payer = owner,
        token::mint = mint,
        token::authority = vault
    )]
    pub vault: Account<'info, TokenAccount>, // Vault for storing the SPL token

    // Constant mint account
    #[account()]
    pub mint: Account<'info, Mint>,

    // The owner who initializes the vault
    #[account(mut)]
    pub owner: Signer<'info>, // Program owner initializing the vault

    pub token_program: Program<'info, Token>, // SPL Token program
    pub rent: Sysvar<'info, Rent>,            // Rent system variable
    pub system_program: Program<'info, System>, // System program
}

#[derive(Accounts)]
pub struct ClaimRewardWithPermission<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>, // Vault (PDA) used as authority
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = sender,
        associated_token::mint = mint,
        associated_token::authority = sender
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>, // System program
}
