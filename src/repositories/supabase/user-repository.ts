import { SupabaseClient } from '@supabase/supabase-js';
import { User, CustomerProfile, Address, Country } from '@/types';
import { IUserRepository, IProfileRepository, IAddressRepository } from '../interfaces';

// ============================================
// USER REPOSITORY
// ============================================

export class SupabaseUserRepository implements IUserRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data as User;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !data) return null;
    return data as User;
  }

  async create(data: {
    email: string;
    password_hash: string;
    role?: 'customer' | 'admin' | 'ops';
  }): Promise<User> {
    const { data: user, error } = await this.supabase
      .from('users')
      .insert({
        email: data.email.toLowerCase(),
        password_hash: data.password_hash,
        role: data.role || 'customer',
      })
      .select()
      .single();

    if (error) throw error;
    return user as User;
  }

  async updatePassword(id: string, password_hash: string): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update({ password_hash })
      .eq('id', id);

    if (error) throw error;
  }

  async updateRole(id: string, role: 'customer' | 'admin' | 'ops'): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update({ role })
      .eq('id', id);

    if (error) throw error;
  }

  async listAdmins(): Promise<User[]> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .in('role', ['admin', 'ops']);

    if (error) throw error;
    return (data || []) as User[];
  }

  async listAll(options?: { role?: string; limit?: number; offset?: number }): Promise<User[]> {
    let query = this.supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (options?.role) query = query.eq('role', options.role);
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 20) - 1);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as User[];
  }
}

// ============================================
// PROFILE REPOSITORY
// ============================================

export class SupabaseProfileRepository implements IProfileRepository {
  constructor(private supabase: SupabaseClient) {}

  async findByUserId(userId: string): Promise<CustomerProfile | null> {
    const { data, error } = await this.supabase
      .from('customer_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return data as CustomerProfile;
  }

  async create(data: {
    user_id: string;
    first_name: string;
    last_name: string;
    phone?: string;
    company_name?: string;
    vat_id?: string;
    default_country?: Country;
  }): Promise<CustomerProfile> {
    const { data: profile, error } = await this.supabase
      .from('customer_profiles')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return profile as CustomerProfile;
  }

  async update(
    userId: string, 
    data: Partial<Omit<CustomerProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<CustomerProfile> {
    const { data: profile, error } = await this.supabase
      .from('customer_profiles')
      .update(data)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return profile as CustomerProfile;
  }
}

// ============================================
// ADDRESS REPOSITORY
// ============================================

export class SupabaseAddressRepository implements IAddressRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<Address | null> {
    const { data, error } = await this.supabase
      .from('addresses')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data as Address;
  }

  async findByUserId(userId: string): Promise<Address[]> {
    const { data, error } = await this.supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Address[];
  }

  async findDefault(userId: string): Promise<Address | null> {
    const { data, error } = await this.supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .single();

    if (error || !data) return null;
    return data as Address;
  }

  async create(data: Omit<Address, 'id' | 'created_at' | 'updated_at'>): Promise<Address> {
    // If this is default, unset other defaults first
    if (data.is_default) {
      await this.supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', data.user_id);
    }

    const { data: address, error } = await this.supabase
      .from('addresses')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return address as Address;
  }

  async update(
    id: string, 
    data: Partial<Omit<Address, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<Address> {
    const { data: address, error } = await this.supabase
      .from('addresses')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return address as Address;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('addresses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async setDefault(userId: string, addressId: string): Promise<void> {
    // Unset all defaults for user
    await this.supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', userId);

    // Set new default
    const { error } = await this.supabase
      .from('addresses')
      .update({ is_default: true })
      .eq('id', addressId);

    if (error) throw error;
  }
}

