export function useToast() {
  return {
    toast: ({ title, description }) => {
      console.log('Toast:', title, description);
    },
  };
}

export const toast = ({ title, description }) => {
  console.log('Toast:', title, description);
};
