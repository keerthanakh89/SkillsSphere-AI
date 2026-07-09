
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getHistory } from '../../modules/mock-interview/services/interviewService';

export const fetchInterviewHistory = createAsyncThunk(
  'interviews/fetchInterviewHistory',
  // @ts-expect-error TODO: Fix pervasive types
  async ({ page = 1, limit = 10 }, { rejectWithValue }) => {
    try {
      const res = await getHistory(page, limit);
      if (!res.success) throw new Error(res.error || 'Failed to fetch interview history');
      return res;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to load interview history.');
    }
  }
);

const initialState = {
  sessions: [],
  analytics: null,
  pagination: { page: 1, pages: 1, total: 0 },
  isLoading: false,
  error: null,
};

const interviewsSlice = createSlice({
  name: 'interviews',
  initialState,
  reducers: {
    clearInterviewsError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInterviewHistory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchInterviewHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.sessions = action.payload?.data || [];
        state.analytics = action.payload?.analytics || null;
        state.pagination = { 
          page: action.payload?.currentPage || 1, 
          pages: action.payload?.totalPages || 1, 
          total: action.payload?.totalDocuments || 0 
        };
      })
      .addCase(fetchInterviewHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearInterviewsError } = interviewsSlice.actions;
export default interviewsSlice.reducer;
