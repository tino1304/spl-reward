use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("7yUhyypH3qAd7KTKpa31AKAv5bEbLtVL5Wf53QSemRvA");

#[program]
pub mod alphado_reward {
    use super::*;

    const TOKEN_MINT: Pubkey = pubkey!("Q3GYuGL11oXLt7u2Tm5XYdKvXxTd3i392ionzPtfMBJ");
    const OWNER: Pubkey = pubkey!("E7oFYw5gBcyQv2xehYXpcqDpT9HnQJQSy8WASkQ2BtKN");

    pub fn initialize(ctx: Context<Initialize>, bump: u8) -> Result<()> {
        require_eq!(ctx.accounts.mint.key(), TOKEN_MINT.key());
        require_eq!(ctx.accounts.owner.key(), OWNER.key());
        Ok(())
    }

    pub fn claim_reward_with_permission(
        ctx: Context<ClaimRewardWithPermission>,
        amount: u64,
        bump: u8,
        max_claimable_amount: u64,
        nonce: u64,
    ) -> Result<()> {
        require_eq!(ctx.accounts.owner.key(), OWNER.key());
        require_eq!(ctx.accounts.vault.mint.key(), TOKEN_MINT.key());
        require_eq!(ctx.accounts.mint.key(), TOKEN_MINT.key());
        require_gt!(max_claimable_amount, 0);
        require_gt!(amount, 0);

        let user_account = &mut ctx.accounts.user_account;

        require_eq!(nonce, user_account.nonce + 1);
        require_gte!(max_claimable_amount, user_account.max_claimable_amount);
        require_gte!(max_claimable_amount, user_account.claimed_amount + amount);

        let vault_seeds: &[&[u8]] = &[b"vault".as_ref(), &[bump]];
        let signer_seeds = &[vault_seeds];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        token::transfer(cpi_ctx, amount)?;

        user_account.claimed_amount += amount;
        user_account.max_claimable_amount = max_claimable_amount;
        user_account.nonce += 1;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [b"vault".as_ref()],
        bump,
        payer = owner,
        token::mint = mint,
        token::authority = vault
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account()]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimRewardWithPermission<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = sender,
        space = 8 + 32 + 8 + 8 + 8,
        seeds = [b"user", sender.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,
    #[account(
        init_if_needed,
        payer = sender,
        associated_token::mint = mint,
        associated_token::authority = sender
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct UserAccount {
    pub user_token_account: Pubkey,
    pub claimed_amount: u64,
    pub max_claimable_amount: u64,
    pub nonce: u64,
}