export type Slot = { date: string; label: string; time: string; available: boolean };
export type BookingDetails = {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  fullAddress: string;
  occasion: string;
  additionalNotes: string;
  date: string;
  time: string;
};

export type Booking = BookingDetails & { confirmationId: string; status: string };
